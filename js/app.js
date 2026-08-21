// ORÈVA Admin Panel — shared shell: auth guard, sidebar nav, toasts, helpers
import { auth, db, ADMIN_EMAIL } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

const NAV_ITEMS = [
  { href: "dashboard.html", key: "dashboard", label: "Dashboard", icon: "grid" },
  { href: "products.html", key: "products", label: "Products", icon: "box" },
  { href: "orders.html", key: "orders", label: "Orders", icon: "bag" },
  { href: "settings.html", key: "settings", label: "Store Settings", icon: "gear" },
];

const ICONS = {
  grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>`,
  box: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>`,
  bag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V6a3 3 0 016 0v2"/></svg>`,
  gear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.55V21a2 2 0 01-4 0v-.09a1.7 1.7 0 00-1-1.55 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.7 1.7 0 004.6 15a1.7 1.7 0 00-1.55-1H3a2 2 0 010-4h.09A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06A1.7 1.7 0 009 4.6a1.7 1.7 0 001-1.55V3a2 2 0 014 0v.09a1.7 1.7 0 001 1.55 1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06A1.7 1.7 0 0019.4 9a1.7 1.7 0 001.55 1H21a2 2 0 010 4h-.09a1.7 1.7 0 00-1.55 1z"/></svg>`,
};

/** Build the sidebar + topbar shell into a page. activeKey matches NAV_ITEMS[].key */
function renderShell(activeKey) {
  const root = document.getElementById("shell-root");
  if (!root) return;

  const navHtml = NAV_ITEMS.map(item => `
    <a class="nav-link ${item.key === activeKey ? "active" : ""}" href="${item.href}">
      ${ICONS[item.icon]}<span>${item.label}</span>
    </a>`).join("");

  root.innerHTML = `
    <div class="sidebar-overlay" id="sidebarOverlay"></div>
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <img src="assets/logo.png" alt="ORÈVA" style="width:34px;height:34px;object-fit:contain;border-radius:8px;"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
        <div class="brand-mark" style="display:none;">O</div>
        <div class="brand-text"><strong>ORÈVA</strong><span>Admin Panel</span></div>
      </div>
      <div class="nav-group">
        <div class="nav-label">Operations</div>
        ${navHtml}
      </div>
      <div class="sidebar-footer">
        <div class="admin-chip">
          <div class="admin-avatar" id="adminAvatar">A</div>
          <div class="admin-meta">
            <strong id="adminName">Admin</strong>
            <span id="adminEmail">—</span>
          </div>
        </div>
        <button class="btn-signout" id="signOutBtn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
          Sign out
        </button>
      </div>
    </aside>
    <div class="topbar">
      <button class="menu-btn" id="menuBtn" aria-label="Open menu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      </button>
      <span class="topbar-title">ORÈVA · ${NAV_ITEMS.find(n => n.key === activeKey)?.label || ""}</span>
    </div>
  `;

  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  document.getElementById("menuBtn")?.addEventListener("click", () => {
    sidebar.classList.add("open");
    overlay.classList.add("open");
  });
  overlay?.addEventListener("click", () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("open");
  });
  document.getElementById("signOutBtn")?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
  });
}

/** Guard a private page: redirect to login if not the admin. Resolves with the user. */
function requireAdmin() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user || user.isAnonymous || (user.email || "").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        window.location.href = "index.html";
        return;
      }
      // Populate sidebar identity chip if present
      const nameEl = document.getElementById("adminName");
      const emailEl = document.getElementById("adminEmail");
      const avatarEl = document.getElementById("adminAvatar");
      let displayName = user.displayName || "Admin";
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists() && snap.data().profileName) displayName = snap.data().profileName;
      } catch (e) { /* non-fatal */ }
      if (nameEl) nameEl.textContent = displayName;
      if (emailEl) emailEl.textContent = user.email;
      if (avatarEl) avatarEl.textContent = (displayName || "A").trim().charAt(0).toUpperCase();
      resolve(user);
    });
  });
}

/** Initialise a private admin page: render shell + enforce auth. */
export async function initPage(activeKey) {
  renderShell(activeKey);
  return requireAdmin();
}

/* ---------------- Toasts ---------------- */
export function toast(message, type = "default") {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity .25s ease";
    setTimeout(() => el.remove(), 260);
  }, 3200);
}

/* ---------------- Formatters ---------------- */
export function formatINR(amount) {
  const n = Number(amount || 0);
  return "₹" + n.toLocaleString("en-IN");
}

export function formatDate(ts) {
  if (!ts) return "—";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(ts) {
  if (!ts) return "—";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function statusBadgeClass(status) {
  return "badge-" + String(status || "").toLowerCase().replace(/\s+/g, "");
}

export function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
