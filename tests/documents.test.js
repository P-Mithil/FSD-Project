import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validatePdfBytes, MAX_FILE_BYTES } from "../src/pdfValidation.js";
import { validateDocxBytes } from "../src/extractDocxText.js";
import { readDocument, documentError } from "../src/readDocument.js";

test("document uploads extract text and reject unsupported, oversized or corrupt files", async () => {
  const bytes = new Uint8Array(await readFile(new URL("./fixtures/resume.docx", import.meta.url)));
  const file = new File([bytes], "resume.docx");
  const text = await readDocument(file, 15000);
  assert.match(text, /React, JavaScript, CSS/);
  await assert.rejects(readDocument(file, 5), /TOO_LONG/);
  await assert.rejects(readDocument(new File(["text"], "resume.txt"), 15000), /INVALID_TYPE/);
  await assert.rejects(readDocument(new File([], "resume.pdf"), 15000), /NO_TEXT/);
  await assert.rejects(readDocument({ name: "resume.pdf", size: MAX_FILE_BYTES + 1 }, 15000), /FILE_TOO_LARGE/);
  assert.throws(() => validateDocxBytes(file, bytes.slice(0, -10)), /INVALID_DOCX/);
  const bomb = bytes.slice();
  const view = new DataView(bomb.buffer);
  for (let index = 0; index < bomb.length - 46; index++) {
    if (view.getUint32(index, true) === 0x02014b50) { view.setUint32(index + 24, 30 * 1024 * 1024, true); break; }
  }
  assert.throws(() => validateDocxBytes(file, bomb), /DOCX_TOO_LARGE/);
  assert.throws(() => validatePdfBytes({ name: "resume.pdf", size: 20 }, new TextEncoder().encode("not a PDF")), /INVALID_PDF/);
  assert.doesNotThrow(() => validatePdfBytes({ name: "resume.pdf", size: 8 }, new TextEncoder().encode("%PDF-1.7")));
  assert.match(documentError(new Error("PASSWORD_PDF"), 15000), /password-protected/);
  assert.ok(!documentError(new Error("private document data"), 15000).includes("private"));
});
