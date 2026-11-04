import { useState, useEffect } from "react";
import { api } from "../api";

function clearCachedPhotos() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith("malla_photo_")) localStorage.removeItem(key);
    }
  } catch (_) {}
}

clearCachedPhotos();

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
    }
  } catch (_) {}
}

export async function getPhoto(username) {
  if (!username) return null;
  try {
    const { photo } = await api(`/photo/${encodeURIComponent(username)}`, { soft401: true });
    if (photo && photo.length > 200000) healPhoto(username, photo);
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
