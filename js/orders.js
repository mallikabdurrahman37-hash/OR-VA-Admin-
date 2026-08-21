import { initPage, toast, formatINR, formatDate, formatDateTime, escapeHtml, debounce, statusBadgeClass } from "./app.js";
import { db } from "./firebase-config.js";
import {
  collection, getDocs, doc, getDoc, updateDoc, Timestamp, query, orderBy,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

const user = await initPage("orders");

const STAGES = ["Placed", "Confirmed", "Processing", "Shipped", "Out for Delivery", "Delivered"];
const SHIPPED_OR_LATER = new Set(["Shipped", "Out for Delivery", "Delivered"]);

let allOrders = [];
let activeFilter = "all";
let searchTerm = "";
let currentOrderId = null;

const wrap = document.getElementById("ordersWrap");
const modal = document.getElementById("orderModal");

/* ---------------- Load & list ---------------- */
async function loadOrders() {
  wrap.innerHTML = `<div class="loader"></div>`;
  try {
    const q = query(collection(db, "orders"), orderBy("orderDate", "desc"));
    const snap = await getDocs(q);
    allOrders = [];
    snap.forEach((d) => allOrders.push({ id: d.id, ...d.data() }));
    renderOrders();

    // Deep-link support: orders.html?id=xxxx
    const params = new URLSearchParams(window.location.search);
    const deepId = params.get("id");
    if (deepId) openOrder(deepId);
  } catch (e) {
    wrap.innerHTML = `<div class="empty-state">Couldn't load orders. ${escapeHtml(e.message)}</div>`;
  }
}

function statusOf(o) {
  return o.cancelled ? "Cancelled" : (o.orderStatus || "Placed");
}

function renderOrders() {
  const term = searchTerm.trim().toLowerCase();
  const list = allOrders.filter((o) => {
    const status = statusOf(o);
    if (activeFilter !== "all" && status !== activeFilter) return false;
    if (!term) return true;
    return (o.customerName || "").toLowerCase().includes(term)
      || (o.phone || "").toLowerCase().includes(term)
      || o.id.toLowerCase().includes(term);
  });

  if (!list.length) {
    wrap.innerHTML = `<div class="empty-state"><strong>No orders found</strong><p>Try a different search or filter.</p></div>`;
    return;
  }

  const rows = list.map((o) => {
    const status = statusOf(o);
    return `
    <tr class="clickable" data-open="${o.id}">
      <td class="cell-strong">#${o.id.slice(-8).toUpperCase()}</td>
      <td>${escapeHtml(o.customerName || "—")}<div class="cell-muted">${escapeHtml(o.phone || "")}</div></td>
      <td>${formatDate(o.orderDate)}</td>
      <td>${(o.items || []).length} item${(o.items || []).length === 1 ? "" : "s"}</td>
      <td>${formatINR(o.totalAmount)}</td>
      <td><span class="badge ${statusBadgeClass(status)}">${escapeHtml(status)}</span></td>
    </tr>`;
  }).join("");

  const cards = list.map((o) => {
    const status = statusOf(o);
    return `
    <div class="mc-card" data-open="${o.id}">
      <div class="mc-row"><span class="mc-title">#${o.id.slice(-8).toUpperCase()}</span><span class="badge ${statusBadgeClass(status)}">${escapeHtml(status)}</span></div>
      <div class="mc-row"><span class="mc-sub">${escapeHtml(o.customerName || "—")}</span><span class="cell-strong">${formatINR(o.totalAmount)}</span></div>
      <div class="mc-row"><span class="mc-sub">${formatDate(o.orderDate)}</span><span class="mc-sub">${(o.items || []).length} items</span></div>
    </div>`;
  }).join("");

  wrap.innerHTML = `
    <table>
      <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="mobile-cards">${cards}</div>`;

  wrap.querySelectorAll("[data-open]").forEach((el) => {
    el.addEventListener("click", () => openOrder(el.getAttribute("data-open")));
  });
}

document.getElementById("searchInput").addEventListener("input", debounce((e) => {
  searchTerm = e.target.value;
  renderOrders();
}, 220));

document.getElementById("filterPills").addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-pill");
  if (!btn) return;
  document.querySelectorAll(".filter-pill").forEach((p) => p.classList.remove("active"));
  btn.classList.add("active");
  activeFilter = btn.dataset.filter;
  renderOrders();
});

/* ---------------- Detail modal ---------------- */
function closeModal() {
  modal.classList.remove("open");
  currentOrderId = null;
  const url = new URL(window.location);
  url.searchParams.delete("id");
  window.history.replaceState({}, "", url);
}
document.getElementById("closeOrderModalBtn").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

async function openOrder(id) {
  currentOrderId = id;
  modal.classList.add("open");
  document.getElementById("orderModalTitle").textContent = "Order #" + id.slice(-8).toUpperCase();
  document.getElementById("orderModalBody").innerHTML = `<div class="loader"></div>`;
  document.getElementById("orderModalFoot").innerHTML = "";

  let o = allOrders.find((x) => x.id === id);
  if (!o) {
    try {
      const snap = await getDoc(doc(db, "orders", id));
      if (!snap.exists()) { toast("Order not found.", "error"); closeModal(); return; }
      o = { id, ...snap.data() };
    } catch (e) {
      toast("Couldn't load order: " + e.message, "error");
      closeModal();
      return;
    }
  }
  renderOrderDetail(o);
}

function trackerHtml(o) {
  const status = statusOf(o);
  if (status === "Cancelled") {
    return `<div class="notice-banner">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 6L6 18M6 6l12 12"/></svg>
      <div><strong>This order was cancelled.</strong> No further fulfilment stages apply.</div>
    </div>`;
  }
  const currentIndex = STAGES.indexOf(status);
  return `<div class="tracker">${STAGES.map((stage, i) => {
    const cls = i < currentIndex ? "done" : i === currentIndex ? "current" : "pending";
    const isLast = i === STAGES.length - 1;
    return `
      <div class="tracker-step ${cls}">
        <div class="tracker-dot-wrap">
          <div class="tracker-dot">${i <= currentIndex ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>` : ""}</div>
          ${!isLast ? `<div class="tracker-line"></div>` : ""}
        </div>
        <div class="tracker-content">
          <strong>Order ${stage}</strong>
          ${i === currentIndex ? `<span>Current stage</span>` : ""}
        </div>
      </div>`;
  }).join("")}</div>`;
}

function renderOrderDetail(o) {
  const status = statusOf(o);
  const items = o.items || [];
  const addr = o.shippingAddress || {};
  const canCancel = !o.cancelled && !SHIPPED_OR_LATER.has(o.orderStatus || "Placed");

  const itemsHtml = Array.isArray(items) && items.length && typeof items[0] === "object"
    ? items.map((it) => `
      <div class="mc-row" style="padding:8px 0;border-bottom:1px solid var(--line);">
        <span>${escapeHtml(it.name || it.productId || "Item")} ${it.quantity ? `× ${it.quantity}` : ""}</span>
        <span class="cell-strong">${it.price != null ? formatINR(it.price) : ""}</span>
      </div>`).join("")
    : `<p class="text-muted">Item details unavailable in a structured format for this order.</p>`;

  document.getElementById("orderModalBody").innerHTML = `
    <div class="field-row" style="align-items:start;">
      <div>
        <h4 style="font-size:14px;margin-bottom:10px;">Fulfilment status</h4>
        ${trackerHtml(o)}
      </div>
      <div>
        <h4 style="font-size:14px;margin-bottom:10px;">Customer</h4>
        <p style="margin:0 0 4px;font-weight:600;">${escapeHtml(o.customerName || "—")}</p>
        <p class="cell-muted" style="margin:0 0 2px;">${escapeHtml(o.customerEmail || "—")}</p>
        <p class="cell-muted" style="margin:0 0 14px;">${escapeHtml(o.phone || "—")}</p>

        <h4 style="font-size:14px;margin-bottom:8px;">Shipping address</h4>
        <p class="cell-muted" style="margin:0;line-height:1.6;">
          ${escapeHtml(addr.name || o.customerName || "")}<br>
          ${escapeHtml(addr.addressLine || "")}<br>
          ${escapeHtml(addr.city || "")}${addr.city ? "," : ""} ${escapeHtml(addr.state || "")} ${escapeHtml(addr.pincode || "")}<br>
          ${escapeHtml(addr.phone || "")}
        </p>
      </div>
    </div>

    <div class="divider"></div>

    <h4 style="font-size:14px;margin-bottom:8px;">Items</h4>
    ${itemsHtml}
    <div style="margin-top:10px;padding-top:10px;">
      <div class="mc-row"><span class="cell-muted">Subtotal</span><span>${formatINR(o.subtotal)}</span></div>
      <div class="mc-row"><span class="cell-muted">Shipping</span><span>${o.shippingCharge ? formatINR(o.shippingCharge) : "Free"}</span></div>
      <div class="mc-row"><span class="cell-strong">Total</span><span class="cell-strong">${formatINR(o.totalAmount)}</span></div>
      <div class="mc-row"><span class="cell-muted">Payment method</span><span>${escapeHtml(o.paymentMethod || "COD")}</span></div>
      <div class="mc-row"><span class="cell-muted">Order date</span><span>${formatDateTime(o.orderDate)}</span></div>
      <div class="mc-row"><span class="cell-muted">Expected delivery</span><span>${formatDate(o.expectedDelivery)}</span></div>
    </div>

    <div class="divider"></div>

    <h4 style="font-size:14px;margin-bottom:8px;">Update status</h4>
    <div class="field-row">
      <div class="field">
        <label for="statusSelect">Fulfilment stage</label>
        <select id="statusSelect" ${o.cancelled ? "disabled" : ""}>
          ${STAGES.map((s) => `<option value="${s}" ${s === (o.orderStatus || "Placed") ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </div>
      <div class="field" style="display:flex;align-items:flex-end;">
        <button class="btn btn-primary" id="saveStatusBtn" style="width:100%;" ${o.cancelled ? "disabled" : ""}>Save status</button>
      </div>
    </div>

    <div class="field">
      <label>Courier service</label>
      <input type="text" id="courierInput" placeholder="e.g. Delhivery" value="${escapeHtml(o.courierService || "")}">
    </div>
    <div class="field">
      <label>Tracking ID</label>
      <div class="copy-field">
        <input type="text" id="trackingInput" placeholder="Tracking ID" value="${escapeHtml(o.trackingId || "")}">
        <button type="button" class="btn btn-ghost btn-sm" id="copyTrackingBtn">Copy</button>
      </div>
      <p class="hint">Courier and tracking details become visible to the customer once the order is marked Shipped or later.</p>
    </div>
    <div class="field">
      <label>Delay note (shown to customer)</label>
      <textarea id="delayNoteInput" placeholder="e.g. Slight delay due to regional courier backlog — new estimate below.">${escapeHtml(o.delayNote || "")}</textarea>
    </div>
    <div class="field">
      <label>Revised expected delivery (optional)</label>
      <input type="date" id="revisedDateInput" value="${dateInputValue(o.expectedDelivery)}">
    </div>
    <button class="btn btn-ghost" id="saveFulfilmentBtn">Save courier, tracking &amp; delay note</button>
  `;

  document.getElementById("orderModalFoot").innerHTML = `
    <button class="btn btn-danger" id="cancelOrderBtn" ${canCancel ? "" : "disabled"}>
      ${o.cancelled ? "Order cancelled" : canCancel ? "Cancel order" : "Cannot cancel — already shipped"}
    </button>
  `;

  // Wire actions
  document.getElementById("saveStatusBtn")?.addEventListener("click", () => saveStatus(o));
  document.getElementById("saveFulfilmentBtn")?.addEventListener("click", () => saveFulfilment(o));
  document.getElementById("cancelOrderBtn")?.addEventListener("click", () => cancelOrder(o));
  document.getElementById("copyTrackingBtn")?.addEventListener("click", () => {
    const val = document.getElementById("trackingInput").value;
    if (!val) { toast("No tracking ID to copy yet.", "error"); return; }
    navigator.clipboard?.writeText(val);
    toast("Tracking ID copied.", "success");
  });
}

function dateInputValue(ts) {
  if (!ts) return "";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

async function saveStatus(o) {
  const select = document.getElementById("statusSelect");
  const newStatus = select.value;
  const btn = document.getElementById("saveStatusBtn");

  if (SHIPPED_OR_LATER.has(newStatus)) {
    const courier = document.getElementById("courierInput").value.trim();
    const tracking = document.getElementById("trackingInput").value.trim();
    if (!courier || !tracking) {
      toast("Add courier service and tracking ID before marking as Shipped.", "error");
      return;
    }
  }

  btn.disabled = true;
  btn.textContent = "Saving…";
  try {
    await updateDoc(doc(db, "orders", o.id), { orderStatus: newStatus });
    Object.assign(o, { orderStatus: newStatus });
    const idx = allOrders.findIndex((x) => x.id === o.id);
    if (idx > -1) allOrders[idx] = { ...allOrders[idx], orderStatus: newStatus };
    toast("Order status updated.", "success");
    renderOrderDetail(o);
    renderOrders();
  } catch (e) {
    toast("Couldn't update status: " + e.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Save status";
  }
}

async function saveFulfilment(o) {
  const btn = document.getElementById("saveFulfilmentBtn");
  const courier = document.getElementById("courierInput").value.trim();
  const tracking = document.getElementById("trackingInput").value.trim();
  const delayNote = document.getElementById("delayNoteInput").value.trim();
  const revisedDate = document.getElementById("revisedDateInput").value;

  const payload = { courierService: courier, trackingId: tracking, delayNote };
  if (revisedDate) payload.expectedDelivery = Timestamp.fromDate(new Date(revisedDate + "T00:00:00"));

  btn.disabled = true;
  btn.textContent = "Saving…";
  try {
    await updateDoc(doc(db, "orders", o.id), payload);
    Object.assign(o, payload);
    toast("Fulfilment details saved.", "success");
    renderOrderDetail(o);
  } catch (e) {
    toast("Couldn't save: " + e.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Save courier, tracking & delay note";
  }
}

async function cancelOrder(o) {
  if (o.cancelled || SHIPPED_OR_LATER.has(o.orderStatus || "Placed")) return;
  if (!confirm("Cancel this order? The customer will see it as cancelled.")) return;
  try {
    // Live backend check: re-read the order to make sure it hasn't shipped since the modal opened.
    const snap = await getDoc(doc(db, "orders", o.id));
    const fresh = snap.data();
    if (!snap.exists() || fresh.cancelled || SHIPPED_OR_LATER.has(fresh.orderStatus || "Placed")) {
      toast("This order can no longer be cancelled — it has already shipped.", "error");
      renderOrderDetail({ id: o.id, ...fresh });
      return;
    }
    await updateDoc(doc(db, "orders", o.id), { cancelled: true, orderStatus: "Cancelled" });
    Object.assign(o, { cancelled: true, orderStatus: "Cancelled" });
    const idx = allOrders.findIndex((x) => x.id === o.id);
    if (idx > -1) allOrders[idx] = { ...allOrders[idx], cancelled: true, orderStatus: "Cancelled" };
    toast("Order cancelled.", "success");
    renderOrderDetail(o);
    renderOrders();
  } catch (e) {
    toast("Couldn't cancel order: " + e.message, "error");
  }
}

loadOrders();
