import { auth, ADMIN_EMAIL } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

const form = document.getElementById("loginForm");
const errorBox = document.getElementById("authError");
const submitBtn = document.getElementById("submitBtn");

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.add("show");
}
function hideError() {
  errorBox.classList.remove("show");
}

// If already signed in as the admin, skip straight to the dashboard.
// If signed in as anyone else, sign them out — this console is admin-only.
onAuthStateChanged(auth, (user) => {
  if (!user) return;
  if ((user.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    window.location.href = "dashboard.html";
  } else {
    signOut(auth);
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    showError("This console is restricted to the ORÈVA admin account.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Signing in…";

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "dashboard.html";
  } catch (err) {
    let msg = "Sign-in failed. Check your email and password.";
    if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
      msg = "Incorrect email or password.";
    } else if (err.code === "auth/user-not-found") {
      msg = "No admin account found for this email.";
    } else if (err.code === "auth/too-many-requests") {
      msg = "Too many attempts. Please wait a moment and try again.";
    }
    showError(msg);
    submitBtn.disabled = false;
    submitBtn.textContent = "Sign in";
  }
});
