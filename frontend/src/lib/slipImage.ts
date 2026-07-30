/**
 * Slip images come straight off a phone camera roll and are routinely 3-6 MB,
 * which is then inflated another ~33% by base64 before it is POSTed to
 * /payment/slip/verify. Downscaling in the browser keeps that request small.
 *
 * The cap is deliberately generous (1600px longest edge, JPEG q0.85): the
 * verifier reads the QR printed on the slip, so squeezing harder risks making a
 * valid slip unreadable. Small images are passed through untouched.
 */
const MAX_EDGE = 1600;
const PASSTHROUGH_BYTES = 1_500_000;

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => resolve(ev.target?.result as string);
    reader.onerror = () => reject(new Error('อ่านไฟล์รูปไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('ไฟล์นี้ไม่ใช่รูปภาพที่อ่านได้'));
    img.src = dataUrl;
  });
}

/** Returns a base64 data URL of the slip, downscaled when it is worth doing. */
export async function toSlipDataUrl(file: File): Promise<string> {
  const original = await readAsDataUrl(file);

  if (file.size <= PASSTHROUGH_BYTES) return original;

  try {
    const img = await loadImage(original);
    const longest = Math.max(img.width, img.height);
    if (longest <= MAX_EDGE) return original;

    const scale = MAX_EDGE / longest;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const resized = canvas.toDataURL('image/jpeg', 0.85);
    // Guard against the rare case where re-encoding grows the payload.
    return resized.length < original.length ? resized : original;
  } catch {
    // Any canvas/decoding failure falls back to the untouched upload rather
    // than blocking a top-up.
    return original;
  }
}
