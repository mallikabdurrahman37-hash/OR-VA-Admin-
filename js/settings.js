import { initPage, toast, formatDateTime, escapeHtml } from "./app.js";
import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

await initPage("settings");

const root = document.getElementById("settingsRoot");
const STORE_REF = doc(db, "settings", "store");

let current = null;

async function load() {
  try {
    const snap = await getDoc(STORE_REF);
    current = snap.exists() ? snap.data() : {};
    render();
  } catch (e) {
    root.innerHTML = `<div class="empty-state">Couldn't load settings. ${escapeHtml(e.message)}</div>`;
  }
}

function render() {
  const s = current;
  root.innerHTML = `
    <div class="card" style="margin-bottom:18px;">
      <div class="card-head">
        <h2>General</h2>
        <span class="cell-muted">Updated ${formatDateTime(s.updatedAt)}</span>
      </div>
      <div class="card-body">
        <div class="field">
          <label for="storeName">Store name</label>
          <input type="text" id="storeName" value="${escapeHtml(s.storeName || "ORÈVA")}">
        </div>
        <div class="field" style="margin-bottom:0;">
          <label for="storeStatus">Store status</label>
          <select id="storeStatus">
            <option value="open" ${s.storeStatus === "open" ? "selected" : ""}>Open</option>
            <option value="closed" ${s.storeStatus === "closed" ? "selected" : ""}>Closed</option>
            <option value="paused" ${s.storeStatus === "paused" ? "selected" : ""}>Paused</option>
          </select>
          <p class="hint">Controls whether the storefront presents itself as taking new orders.</p>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:18px;">
      <div class="card-head"><h2>Checkout &amp; shipping</h2></div>
      <div class="card-body" style="padding-top:4px;">
        <div class="switch-row">
          <div class="switch-label"><strong>Cash on Delivery</strong><span>COD is the only payment method — this toggle enables/disables checkout.</span></div>
          <label class="switch"><input type="checkbox" id="codEnabled" ${s.codEnabled !== false ? "checked" : ""}><span class="track"></span><span class="thumb"></span></label>
        </div>
        <div class="switch-row">
          <div class="switch-label"><strong>Shipping charges enabled</strong><span>When off, the default shipping charge below is not applied at checkout.</span></div>
          <label class="switch"><input type="checkbox" id="shippingEnabled" ${s.shippingEnabled !== false ? "checked" : ""}><span class="track"></span><span class="thumb"></span></label>
        </div>
        <div class="field" style="margin-top:16px;margin-bottom:0;">
          <label for="defaultShippingCharge">Default shipping charge (₹)</label>
          <input type="number" id="defaultShippingCharge" min="0" value="${s.defaultShippingCharge ?? 0}">
          <p class="hint">Used only when a product doesn't have its own shipping charge set. 0 means free shipping.</p>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:18px;">
      <div class="card-head"><h2>Maintenance &amp; announcement</h2></div>
      <div class="card-body" style="padding-top:4px;">
        <div class="switch-row">
          <div class="switch-label"><strong>Maintenance mode</strong><span>Shows a maintenance page to customers and pauses checkout.</span></div>
          <label class="switch"><input type="checkbox" id="maintenanceMode" ${s.maintenanceMode ? "checked" : ""}><span class="track"></span><span class="thumb"></span></label>
        </div>
        <div class="field" style="margin-top:16px;margin-bottom:0;">
          <label for="announcement">Storefront announcement</label>
          <textarea id="announcement" placeholder="e.g. Monsoon sale — free shipping this week only.">${escapeHtml(s.announcement || "")}</textarea>
          <p class="hint">Shown as a banner on the storefront. Leave blank to hide it.</p>
        </div>
      </div>
    </div>

    <button class="btn btn-primary" id="saveSettingsBtn">Save settings</button>
  `;

  document.getElementById("saveSettingsBtn").addEventListener("click", save);
}

async function save() {
  const btn = document.getElementById("saveSettingsBtn");
  btn.disabled = true;
  btn.textContent = "Saving…";

  const payload = {
    storeName: document.getElementById("storeName").value.trim() || "ORÈVA",
    storeStatus: document.getElementById("storeStatus").value,
    codEnabled: document.getElementById("codEnabled").checked,
    shippingEnabled: document.getElementById("shippingEnabled").checked,
    defaultShippingCharge: Number(document.getElementById("defaultShippingCharge").value || 0),
    maintenanceMode: document.getElementById("maintenanceMode").checked,
    announcement: document.getElementById("announcement").value.trim(),
    updatedAt: serverTimestamp(),
  };

  try {
    // merge:true so we never create a duplicate settings document or drop unknown fields.
    await setDoc(STORE_REF, payload, { merge: true });
    toast("Settings saved.", "success");
    current = { ...current, ...payload };
    load();
  } catch (e) {
    toast("Couldn't save settings: " + e.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Save settings";
  }
}

load();
