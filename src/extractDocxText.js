import { MAX_FILE_BYTES } from "./pdfValidation.js";

export function validateDocxBytes(file, bytes) {
  if (file.size > MAX_FILE_BYTES || bytes.byteLength > MAX_FILE_BYTES)
    throw new Error("FILE_TOO_LARGE");
  if (
    !file.name.toLowerCase().endsWith(".docx") ||
    bytes.length < 22 ||
    bytes[0] !== 0x50 ||
    bytes[1] !== 0x4b
  )
    throw new Error("INVALID_DOCX");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (
    let at = bytes.length - 22;
    at >= Math.max(0, bytes.length - 65557);
    at--
  ) {
    if (
      view.getUint32(at, true) === 0x06054b50 &&
      at + 22 + view.getUint16(at + 20, true) === bytes.length
    ) {
      end = at;
      break;
    }
  }
  if (end < 0) throw new Error("INVALID_DOCX");
  const entries = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  let total = 0;
  const names = new Set();
  if (
    !entries ||
    entries > 2000 ||
    view.getUint16(end + 4, true) !== 0 ||
    view.getUint16(end + 6, true) !== 0
  )
    throw new Error("INVALID_DOCX");
  for (let index = 0; index < entries; index++) {
    if (at + 46 > end || view.getUint32(at, true) !== 0x02014b50)
      throw new Error("INVALID_DOCX");
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const next =
      at +
      46 +
      nameLength +
      view.getUint16(at + 30, true) +
      view.getUint16(at + 32, true);
    if (
      next > end ||
      view.getUint16(at + 8, true) & 1 ||
      ![0, 8].includes(view.getUint16(at + 10, true))
    )
      throw new Error("INVALID_DOCX");
    const name = new TextDecoder().decode(
      bytes.subarray(at + 46, at + 46 + nameLength),
    );
    total += size;
    names.add(name);
    if (
      total > 20 * 1024 * 1024 ||
      (name === "word/document.xml" && size > 2 * 1024 * 1024)
    )
      throw new Error("DOCX_TOO_LARGE");
    at = next;
  }
  if (!names.has("word/document.xml") || !names.has("[Content_Types].xml"))
    throw new Error("INVALID_DOCX");
}

export async function extractDocxText(file) {
  const arrayBuffer = await file.arrayBuffer();
  validateDocxBytes(file, new Uint8Array(arrayBuffer));
  try {
    const { default: mammoth } = await import("mammoth/mammoth.browser.js");
    // Raw text only: never render document HTML or load external document resources.
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.replace(/\n{3,}/g, "\n\n").trim();
  } catch {
    throw new Error("INVALID_DOCX");
  }
}
