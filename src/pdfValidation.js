export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export function validatePdfBytes(file, bytes) {
  if (
    !(
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    )
  ) {
    throw new Error("INVALID_PDF");
  }
  if (file.size > MAX_FILE_BYTES || bytes.byteLength > MAX_FILE_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }
  // A .pdf extension or MIME type alone does not prove the file is a PDF.
  const signature = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  if (signature.some((byte, index) => bytes[index] !== byte)) {
    throw new Error("INVALID_PDF");
  }
  // PDF.js validates the remaining document structure during extraction.
}
