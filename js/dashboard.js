import { initPage, formatINR, formatDate, statusBadgeClass, escapeHtml } from "./app.js";
import { db } from "./firebase-config.js";
import {
  collection, getDocs, query, orderBy, limit, doc, getDoc,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

await initPage("dashboard");

const LOW_STOCK_THRESHOLD = 5;

const ICONS = {
  orders: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V6a3 3 0 016 0v2"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`,
  truck: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1" y="6" width="14" height="11"/><path d="M15 10h4l3 3v4h-7z"/><circle cx="6" cy="18.5" r="1.6"/><circle cx="17.5" cy="18.5" r="1.6"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 6L9 17l-5-5"/></svg>`,
  x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
  box: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/></svg>`,
  warn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L2.5 18a2 2 0 001.7 3h15.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>`,
};

function statCard({ icon, label, value, sub, tone }) {
  return `
    <div class="stat-card ${tone || ""}">
      <div class="stat-top">
        <span class="stat-label">${label}</span>
        <div class="stat-icon">${ICONS[icon]}</div>
      </div>
      <div class="stat-value">${value}</div>
      ${sub ? `<div class="stat-sub">${sub}</div>` : ""}
    </div>`;
}

async function loadStoreNotice() {
  try {
    const snap = await getDoc(doc(db, "settings", "store"));
    if (!snap.exists()) return;
    const s = snap.data();
    const box = document.getElementById("storeNotice");
    if (s.maintenanceMode) {
      box.innerHTML = `<div class="notice-banner">${ICONS.warn}<div><strong>Maintenance mode is ON.</strong> Customers currently see a maintenance page on the storefront. Turn it off in Store Settings when you're ready to reopen.</div></div>`;
    } else if (s.storeStatus && s.storeStatus !== "open") {
      box.innerHTML = `<div class="notice-banner">${ICONS.warn}<div><strong>Store status: ${escapeHtml(s.storeStatus)}.</strong> Review Store Settings to confirm this is intended.</div></div>`;
    }
  } catch (e) { /* non-fatal */ }
}

async function loadStats() {
  const grid = document.getElementById("statGrid");
  try {
    const [ordersSnap, productsSnap] = await Promise.all([
      getDocs(collection(db, "orders")),
      getDocs(collection(db, "products")),
    ]);

    const counts = { total: 0, pending: 0, shipped: 0, delivered: 0, cancelled: 0 };
    ordersSnap.forEach((d) => {
      const o = d.data();
      counts.total++;
      if (o.cancelled || o.orderStatus === "Cancelled") counts.cancelled++;
      else if (o.orderStatus === "Delivered") counts.delivered++;
      else if (o.orderStatus === "Shipped" || o.orderStatus === "Out for Delivery") counts.shipped++;
      else counts.pending++;
    });

    let productCount = 0, lowStock = 0;
    productsSnap.forEach((d) => {
      const p = d.data();
      productCount++;
      if (typeof p.stock === "number" && p.stock <= LOW_STOCK_THRESHOLD) lowStock++;
    });

    grid.innerHTML = [
      statCard({ icon: "orders", label: "Total orders", value: counts.total }),
      statCard({ icon: "clock", label: "Pending / processing", value: counts.pending, tone: counts.pending ? "warn" : "" }),
      statCard({ icon: "truck", label: "Shipped", value: counts.shipped }),
      statCard({ icon: "check", label: "Delivered", value: counts.delivered }),
      statCard({ icon: "x", label: "Cancelled", value: counts.cancelled, tone: counts.cancelled ? "danger" : "" }),
      statCard({ icon: "box", label: "Products", value: productCount }),
      statCard({ icon: "warn", label: "Low stock", value: lowStock, sub: `≤ ${LOW_STOCK_THRESHOLD} units`, tone: lowStock ? "danger" : "" }),
    ].join("");
  } catch (e) {
    grid.innerHTML = `<div class="empty-state">Couldn't load stats. ${escapeHtml(e.message)}</div>`;
  }
}

async function loadRecentOrders() {
  const wrap = document.getElementById("recentOrdersWrap");
  try {
    const q = query(collection(db, "orders"), orderBy("orderDate", "desc"), limit(8));
    const snap = await getDocs(q);
    if (snap.empty) {
      wrap.innerHTML = `<div class="empty-state"><strong>No orders yet</strong><p>New orders will appear here as customers check out.</p></div>`;
      return;
    }
    const rows = [];
    snap.forEach((d) => {
      const o = d.data();
      const status = o.cancelled ? "Cancelled" : (o.orderStatus || "Placed");
      rows.push(`
        <tr class="clickable" onclick="window.location.href='orders.html?id=${d.id}'">
          <td class="cell-strong">#${d.id.slice(-8).toUpperCase()}</td>
          <td>${escapeHtml(o.customerName || "—")}</td>
          <td>${formatDate(o.orderDate)}</td>
          <td>${formatINR(o.totalAmount)}</td>
          <td><span class="badge ${statusBadgeClass(status)}">${escapeHtml(status)}</span></td>
        </tr>`);
    });
    wrap.innerHTML = `
      <table>
        <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th></tr></thead>
        <tbody>${rows.join("")}</tbody>
      </table>`;
  } catch (e) {
    wrap.innerHTML = `<div class="empty-state">Couldn't load orders. ${escapeHtml(e.message)}</div>`;
  }
}

loadStoreNotice();
loadStats();
loadRecentOrders();
