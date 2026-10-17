import test from "node:test";
import assert from "node:assert/strict";
import { validatePdfBytes, MAX_FILE_BYTES } from "../src/pdfValidation.js";

const bytes = (text) => new TextEncoder().encode(text);
const file = { name: "resume.pdf", type: "application/pdf", size: 20 };

test("rejects a text file renamed to PDF, empty files, and truncated signatures", () => {
  for (const content of ["This is plain text", "", "%PD"]) {
    assert.throws(() => validatePdfBytes(file, bytes(content)), /INVALID_PDF/);
  }
});
test("rejects PDFs exceeding 5 MB using either file metadata or actual bytes", () => {
  assert.throws(
    () =>
      validatePdfBytes(
        { ...file, size: MAX_FILE_BYTES + 1 },
        bytes("%PDF-1.7"),
      ),
    /FILE_TOO_LARGE/,
  );
  assert.throws(
    () => validatePdfBytes(file, new Uint8Array(MAX_FILE_BYTES + 1)),
    /FILE_TOO_LARGE/,
  );
});
test("accepts a PDF signature for further parsing, rejects non-PDF file types", () => {
  assert.doesNotThrow(() => validatePdfBytes(file, bytes("%PDF-1.7")));
  assert.throws(
    () =>
      validatePdfBytes(
        { ...file, name: "resume.txt", type: "text/plain" },
        bytes("%PDF-1.7"),
      ),
    /INVALID_PDF/,
  );
});
