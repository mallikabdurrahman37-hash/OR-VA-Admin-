import { initPage, toast, formatINR, escapeHtml, debounce } from "./app.js";
import { db } from "./firebase-config.js";
import { uploadImageToCloudinary } from "./cloudinary.js";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

await initPage("products");

let allProducts = [];   // [{id, ...data}]
let currentImages = []; // secure URLs for the product currently being edited
let editingId = null;
let activeFilter = "all";
let searchTerm = "";
const LOW_STOCK_THRESHOLD = 5;

const wrap = document.getElementById("productsWrap");
const modal = document.getElementById("productModal");
const form = document.getElementById("productForm");

/* ---------------- Load & render ---------------- */
async function loadProducts() {
  wrap.innerHTML = `<div class="loader"></div>`;
  try {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    allProducts = [];
    snap.forEach((d) => allProducts.push({ id: d.id, ...d.data() }));
    renderProducts();
  } catch (e) {
    wrap.innerHTML = `<div class="empty-state">Couldn't load products. ${escapeHtml(e.message)}</div>`;
  }
}

function matchesFilter(p) {
  if (activeFilter === "active") return p.isActive !== false;
  if (activeFilter === "inactive") return p.isActive === false;
  if (activeFilter === "lowstock") return typeof p.stock === "number" && p.stock <= LOW_STOCK_THRESHOLD;
  if (activeFilter === "featured") return !!p.featured;
  return true;
}

function renderProducts() {
  const term = searchTerm.trim().toLowerCase();
  const list = allProducts.filter((p) => {
    if (!matchesFilter(p)) return false;
    if (!term) return true;
    return (p.name || "").toLowerCase().includes(term) || (p.category || "").toLowerCase().includes(term);
  });

  if (!list.length) {
    wrap.innerHTML = `<div class="empty-state">
      <strong>No products found</strong>
      <p>${allProducts.length ? "Try a different search or filter." : "Add your first product to get started."}</p>
    </div>`;
    return;
  }

  const rowsHtml = list.map((p) => rowHtml(p)).join("");
  const cardsHtml = list.map((p) => cardHtml(p)).join("");

  wrap.innerHTML = `
    <table>
      <thead><tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div class="mobile-cards">${cardsHtml}</div>
  `;

  wrap.querySelectorAll("[data-edit]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      openEditor(el.getAttribute("data-edit"));
    });
  });
}

function rowHtml(p) {
  const img = p.images?.[0] || "";
  const lowStock = typeof p.stock === "number" && p.stock <= LOW_STOCK_THRESHOLD;
  return `
    <tr class="clickable" data-edit="${p.id}">
      <td style="width:52px;">
        <div style="width:40px;height:40px;border-radius:8px;overflow:hidden;background:#f2f0ea;border:1px solid var(--line);">
          ${img ? `<img src="${escapeHtml(img)}" style="width:100%;height:100%;object-fit:cover;">` : ""}
        </div>
      </td>
      <td class="cell-strong">${escapeHtml(p.name || "Untitled")}${p.featured ? ' <span class="badge badge-active" style="margin-left:6px;">Featured</span>' : ""}</td>
      <td class="cell-muted">${escapeHtml(p.category || "—")}</td>
      <td>${formatINR(p.price)}${p.compareAtPrice ? `<div class="cell-muted" style="text-decoration:line-through;">${formatINR(p.compareAtPrice)}</div>` : ""}</td>
      <td>${lowStock ? `<span class="badge badge-lowstock">${p.stock} left</span>` : (p.stock ?? "—")}</td>
      <td><span class="badge ${p.isActive === false ? "badge-inactive" : "badge-active"}">${p.isActive === false ? "Inactive" : "Active"}</span></td>
      <td style="text-align:right;"><button class="btn btn-ghost btn-sm" data-edit="${p.id}">Edit</button></td>
    </tr>`;
}

function cardHtml(p) {
  const lowStock = typeof p.stock === "number" && p.stock <= LOW_STOCK_THRESHOLD;
  return `
    <div class="mc-card" data-edit="${p.id}">
      <div class="mc-row">
        <span class="mc-title">${escapeHtml(p.name || "Untitled")}</span>
        <span class="badge ${p.isActive === false ? "badge-inactive" : "badge-active"}">${p.isActive === false ? "Inactive" : "Active"}</span>
      </div>
      <div class="mc-row">
        <span class="mc-sub">${escapeHtml(p.category || "—")}</span>
        <span class="cell-strong">${formatINR(p.price)}</span>
      </div>
      <div class="mc-row">
        <span class="mc-sub">${lowStock ? `<span class="badge badge-lowstock">${p.stock} left</span>` : `Stock: ${p.stock ?? "—"}`}</span>
        <span class="mc-sub">${p.featured ? "★ Featured" : ""}</span>
      </div>
    </div>`;
}

document.getElementById("searchInput").addEventListener("input", debounce((e) => {
  searchTerm = e.target.value;
  renderProducts();
}, 220));

document.getElementById("filterPills").addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-pill");
  if (!btn) return;
  document.querySelectorAll(".filter-pill").forEach((p) => p.classList.remove("active"));
  btn.classList.add("active");
  activeFilter = btn.dataset.filter;
  renderProducts();
});

/* ---------------- Modal / editor ---------------- */
function resetForm() {
  form.reset();
  currentImages = [];
  editingId = null;
  document.getElementById("pIsActive").checked = true;
  document.getElementById("deleteProductBtn").style.display = "none";
  renderImageStrip();
}

function openNew() {
  resetForm();
  document.getElementById("modalTitle").textContent = "New product";
  modal.classList.add("open");
}

function openEditor(id) {
  const p = allProducts.find((x) => x.id === id);
  if (!p) return;
  resetForm();
  editingId = id;
  document.getElementById("modalTitle").textContent = "Edit product";
  document.getElementById("pName").value = p.name || "";
  document.getElementById("pDescription").value = p.description || "";
  document.getElementById("pCategory").value = p.category || "";
  document.getElementById("pSizes").value = (p.sizes || []).join(", ");
  document.getElementById("pPrice").value = p.price ?? "";
  document.getElementById("pCompareAtPrice").value = p.compareAtPrice ?? "";
  document.getElementById("pStock").value = p.stock ?? "";
  document.getElementById("pShipping").value = p.shippingCharge ?? 0;
  document.getElementById("pFeatured").checked = !!p.featured;
  document.getElementById("pBestSeller").checked = !!p.bestSeller;
  document.getElementById("pIsActive").checked = p.isActive !== false;
  currentImages = [...(p.images || [])];
  renderImageStrip();
  document.getElementById("deleteProductBtn").style.display = "inline-flex";
  modal.classList.add("open");
}

function closeModal() {
  modal.classList.remove("open");
}

document.getElementById("newProductBtn").addEventListener("click", openNew);
document.getElementById("closeModalBtn").addEventListener("click", closeModal);
document.getElementById("cancelModalBtn").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

/* ---------------- Image upload ---------------- */
const uploadZone = document.getElementById("uploadZone");
const fileInput = document.getElementById("fileInput");
const imageStrip = document.getElementById("imageStrip");

uploadZone.addEventListener("click", () => {
  if (currentImages.length >= 5) {
    toast("You can upload up to 5 images per product.", "error");
    return;
  }
  fileInput.click();
});

fileInput.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []).slice(0, 5 - currentImages.length);
  fileInput.value = "";
  for (const file of files) {
    const placeholderId = "up-" + Math.random().toString(36).slice(2);
    renderImageStrip(placeholderId);
    try {
      const url = await uploadImageToCloudinary(file);
      currentImages.push(url);
      renderImageStrip();
    } catch (err) {
      toast(err.message || "Image upload failed.", "error");
      renderImageStrip();
    }
  }
});

function renderImageStrip(uploadingPlaceholder) {
  const thumbs = currentImages.map((url, i) => `
    <div class="image-thumb">
      <img src="${escapeHtml(url)}">
      ${i === 0 ? `<span class="primary-tag">Primary</span>` : ""}
      <button type="button" class="remove-thumb" data-remove="${i}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>`).join("");
  const placeholder = uploadingPlaceholder ? `<div class="image-thumb uploading"><div class="loader" style="margin:0;width:16px;height:16px;position:absolute;top:31px;left:31px;"></div></div>` : "";
  imageStrip.innerHTML = thumbs + placeholder;
  imageStrip.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentImages.splice(Number(btn.dataset.remove), 1);
      renderImageStrip();
    });
  });
}

/* ---------------- Save / delete ---------------- */
document.getElementById("saveProductBtn").addEventListener("click", async () => {
  if (!form.reportValidity()) return;
  if (currentImages.length === 0) {
    toast("Add at least one product image.", "error");
    return;
  }

  const saveBtn = document.getElementById("saveProductBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  const payload = {
    name: document.getElementById("pName").value.trim(),
    description: document.getElementById("pDescription").value.trim(),
    category: document.getElementById("pCategory").value.trim(),
    price: Number(document.getElementById("pPrice").value),
    compareAtPrice: document.getElementById("pCompareAtPrice").value ? Number(document.getElementById("pCompareAtPrice").value) : 0,
    images: currentImages.slice(0, 5),
    featured: document.getElementById("pFeatured").checked,
    bestSeller: document.getElementById("pBestSeller").checked,
    stock: Number(document.getElementById("pStock").value),
    sizes: document.getElementById("pSizes").value.split(",").map((s) => s.trim()).filter(Boolean),
    isActive: document.getElementById("pIsActive").checked,
    shippingCharge: document.getElementById("pShipping").value ? Number(document.getElementById("pShipping").value) : 0,
  };

  try {
    if (editingId) {
      await updateDoc(doc(db, "products", editingId), payload);
      toast("Product updated.", "success");
    } else {
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "products"), payload);
      toast("Product created.", "success");
    }
    closeModal();
    await loadProducts();
  } catch (e) {
    toast("Couldn't save product: " + e.message, "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save product";
  }
});

document.getElementById("deleteProductBtn").addEventListener("click", async () => {
  if (!editingId) return;
  if (!confirm("Delete this product permanently? This cannot be undone.")) return;
  try {
    await deleteDoc(doc(db, "products", editingId));
    toast("Product deleted.", "success");
    closeModal();
    await loadProducts();
  } catch (e) {
    toast("Couldn't delete product: " + e.message, "error");
  }
});

loadProducts();
