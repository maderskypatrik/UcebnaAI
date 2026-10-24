/** Longest edge after shrinking: still sharp enough for Claude to read a textbook page. */
const MAX_EDGE = 1800;
const QUALITY = 0.8;
/** Photos smaller than this are sent as they are. */
const SMALL_ENOUGH = 700 * 1024;

const SHRINKABLE = /^image\/(jpeg|png|webp|heic|heif)$/;

/**
 * Phone photos are often 3–8 MB each, but Vercel accepts at most 4.5 MB per request.
 * Scale them down to JPEG in the browser so several textbook pages fit in one upload.
 */
export async function shrinkImage(file: File): Promise<File> {
  const isHeic = /\.(heic|heif)$/i.test(file.name) || /heic|heif/.test(file.type);
  if (!SHRINKABLE.test(file.type) && !isHeic) return file;
  if (file.size <= SMALL_ENOUGH && !isHeic) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    if (isHeic) throw new Error(`Fotku „${file.name}“ (HEIC) neumíme otevřít. Pošlete ji prosím jako JPEG.`);
    return file;
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) return file;
  // White behind transparent PNGs, which would otherwise turn black as JPEG.
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  if (!blob || (blob.size >= file.size && !isHeic)) return file;
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

export const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} kB`
    : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;

/** Longest edge of a picture printed on the sheet: sharp on A4, small enough to keep in the Kabinet. */
const PICTURE_EDGE = 1200;

/** A picture for a picture part as a JPEG data URL, scaled down so it can travel inside the sheet. */
export async function pictureDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, PICTURE_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}
