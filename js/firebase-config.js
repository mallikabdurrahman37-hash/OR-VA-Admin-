// ORÈVA Admin Panel — Firebase + Cloudinary configuration
// Same Firebase project / Cloudinary preset as the customer storefront.
// Do NOT change these values without updating the storefront in parallel.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyCa7OTJEyx4v90upw8xc9Y3aXWETfIMFts",
  authDomain: "eddy-s-portfolio.firebaseapp.com",
  projectId: "eddy-s-portfolio",
  storageBucket: "eddy-s-portfolio.firebasestorage.app",
  messagingSenderId: "363833751972",
  appId: "1:363833751972:web:c87f12a3446ffff5d42931",
  measurementId: "G-Q2E87TYZDW"
};

// The single Gmail address permitted to use this private admin panel.
// Firestore security rules are the real authority — this is only used
// client-side to decide what to render and to fail fast with a clear message.
export const ADMIN_EMAIL = "mallikabdurrahman37@gmail.com";

// Cloudinary — product image uploads (unsigned upload preset)
export const CLOUDINARY_CLOUD_NAME = "dyt6fwvw0";
export const CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1/dyt6fwvw0/image/upload";
export const CLOUDINARY_UPLOAD_PRESET = "Wb_mobile_products";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
