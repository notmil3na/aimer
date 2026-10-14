import { useState, useEffect } from "react";
import { api } from "../api";

const cacheKey = (username) => `malla_photo_${username}`;

export function setPhotoCache(username, photo) {
  try {
    if (photo) localStorage.setItem(cacheKey(username), photo);
    else localStorage.removeItem(cacheKey(username));
  } catch (_) {}
}

export async function compressPhoto(dataUrl, maxSize = 256, quality = 0.82) {
  if (typeof document === "undefined" || !dataUrl) return dataUrl;
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = dataUrl;
    });
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    if (scale === 1 && dataUrl.startsWith("data:image/jpeg")) return dataUrl;
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    const out = canvas.toDataURL("image/jpeg", quality);
    return out.length < dataUrl.length ? out : dataUrl;
  } catch (_) {
    return dataUrl;
  }
}

async function healPhoto(username, photo) {
  try {
    const small = await compressPhoto(photo, 256, 0.82);
    if (small && small !== photo) {
      await api("/users", { method: "POST", body: { photo: small } });
      setPhotoCache(username, small);
    }
  } catch (_) {}
}

export async function getPhoto(username) {
  if (!username) return null;
  try {
    const cached = localStorage.getItem(cacheKey(username));
    if (cached) return cached;
  } catch (_) {}
  try {
    const { photo } = await api(`/photo/${encodeURIComponent(username)}`, { soft401: true });
    if (photo) {
      setPhotoCache(username, photo);
      if (photo.length > 200000) healPhoto(username, photo);
    }
    return photo || null;
  } catch (_) {
    return null;
  }
}

export function usePhoto(username, hasPhoto) {
  const [photo, setPhoto] = useState(null);
  useEffect(() => {
    if (!username || !hasPhoto) {
      setPhoto(null);
      return;
    }
    let on = true;
    getPhoto(username).then((p) => {
      if (on) setPhoto(p);
    });
    return () => {
      on = false;
    };
  }, [username, hasPhoto]);
  return photo;
}
