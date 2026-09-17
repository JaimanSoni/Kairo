/**
 * Pictures in a page go straight from the browser to Cloudinary, with an
 * unsigned preset. Kairo never holds the bytes: the page keeps the address
 * that comes back.
 *
 * Both values are public by design (they are in the browser bundle either
 * way); the preset is what limits what may be uploaded, on Cloudinary's side.
 */

export const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
export const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "";
export const uploadsEnabled = Boolean(CLOUD_NAME && UPLOAD_PRESET);

/** As much as one picture may weigh. Past this, a phone photo would take the page down with it. */
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export type Uploaded = { url: string; width: number | null; height: number | null };

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") && file.type !== "image/svg+xml";
}

/** What to say when a file cannot go up, or null when it can. */
export function refuseReason(file: File): string | null {
  if (!uploadsEnabled) return "Pictures aren't set up on this server yet.";
  if (file.type === "image/svg+xml") return "SVG files aren't supported here.";
  if (!file.type.startsWith("image/")) return "That file isn't a picture.";
  if (file.size > MAX_IMAGE_BYTES) return `That picture is over ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB. Try a smaller one.`;
  return null;
}

/**
 * Sends one picture up, reporting how far it has got. XHR rather than fetch
 * because it is the only way to know: a progress bar that jumps from nothing
 * to done is not a progress bar.
 */
export function uploadImage(file: File, onProgress?: (fraction: number) => void): { done: Promise<Uploaded>; cancel: () => void } {
  const xhr = new XMLHttpRequest();
  const done = new Promise<Uploaded>((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", UPLOAD_PRESET);

    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`);
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    });
    xhr.addEventListener("load", () => {
      try {
        const body = JSON.parse(xhr.responseText) as { secure_url?: string; width?: number; height?: number; error?: { message?: string } };
        if (xhr.status >= 200 && xhr.status < 300 && body.secure_url) {
          resolve({ url: body.secure_url, width: body.width ?? null, height: body.height ?? null });
        } else {
          reject(new Error(body.error?.message ?? "That picture didn't upload."));
        }
      } catch {
        reject(new Error("That picture didn't upload."));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("That picture didn't upload. Check your connection.")));
    xhr.addEventListener("abort", () => reject(new Error("Upload stopped.")));
    xhr.send(form);
  });
  return { done, cancel: () => xhr.abort() };
}

/**
 * A narrower copy for the page: Cloudinary resizes on its own URLs, so a
 * 4000px photo is not shipped to a 700px column. Anything not from Cloudinary
 * is left exactly as it is.
 */
export function sized(url: string, width: number): string {
  if (!/^https:\/\/res\.cloudinary\.com\//.test(url)) return url;
  return url.replace(/\/upload\/(?!.*\/upload\/)/, `/upload/f_auto,q_auto,w_${width}/`);
}
