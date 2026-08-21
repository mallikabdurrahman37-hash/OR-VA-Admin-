// Cloudinary unsigned upload helper — same endpoint/preset as the storefront.
import { CLOUDINARY_UPLOAD_URL, CLOUDINARY_UPLOAD_PRESET } from "./firebase-config.js";

/**
 * Uploads a single image file to Cloudinary and returns its secure URL.
 * @param {File} file
 * @param {(pct:number)=>void} [onProgress]
 * @returns {Promise<string>}
 */
export function uploadImageToCloudinary(file, onProgress) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Only image files can be uploaded."));
      return;
    }
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", CLOUDINARY_UPLOAD_URL);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && res.secure_url) {
          resolve(res.secure_url);
        } else {
          reject(new Error(res?.error?.message || "Upload failed."));
        }
      } catch (err) {
        reject(new Error("Upload failed — unexpected response."));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed — network error."));
    xhr.send(form);
  });
}
