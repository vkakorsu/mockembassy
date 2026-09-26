/**
 * Phone photos of paper documents → one compact PDF, in the browser.
 * Each page is decoded with its camera rotation applied, scaled to at most
 * 2000 px on the long edge (plenty for reading, far smaller than the photo)
 * and re-encoded as JPEG. pdf-lib is loaded only when someone uploads photos.
 */

const MAX_EDGE = 2000;

async function pageJpeg(file: File): Promise<{ bytes: ArrayBuffer; width: number; height: number }> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const width = Math.round(bmp.width * scale);
  const height = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bmp, 0, 0, width, height);
  bmp.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
  if (!blob) throw new Error("Couldn't encode the photo");
  return { bytes: await blob.arrayBuffer(), width, height };
}

export async function photosToPdf(files: File[]): Promise<Blob> {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  for (const f of files) {
    const { bytes, width, height } = await pageJpeg(f);
    const img = await pdf.embedJpg(bytes);
    pdf.addPage([width, height]).drawImage(img, { x: 0, y: 0, width, height });
  }
  return new Blob([new Uint8Array(await pdf.save())], { type: "application/pdf" });
}
