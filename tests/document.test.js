import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readDocument, documentError } from "../src/readDocument.js";

test("shared document reader extracts DOCX text and enforces the caller's text limit", async () => {
  const bytes = await readFile(new URL("./fixtures/resume.docx", import.meta.url));
  const file = new File([bytes], "Resume.DOCX");
  const text = await readDocument(file, 15000);
  assert.match(text, /React, JavaScript, CSS/);
  await assert.rejects(readDocument(file, text.length - 1), /TOO_LONG/);
});

test("shared reader rejects unsupported, empty, oversized and corrupt documents", async () => {
  await assert.rejects(readDocument(new File(["text"], "resume.txt"), 15000), /INVALID_TYPE/);
  await assert.rejects(readDocument(new File([], "resume.pdf"), 15000), /NO_TEXT/);
  await assert.rejects(readDocument({ name: "resume.pdf", size: 5 * 1024 * 1024 + 1 }, 15000), /FILE_TOO_LARGE/);
  await assert.rejects(readDocument(new File(["bad ZIP"], "resume.docx"), 15000), /INVALID_DOCX/);
});

test("shared document errors preserve useful validation messages without exposing raw errors", () => {
  assert.match(documentError(new Error("PASSWORD_PDF"), 15000), /password-protected/);
  assert.match(documentError(new Error("TOO_MANY_PAGES"), 15000), /20 pages/);
  assert.match(documentError(new Error("TOO_LONG"), 12000), /12,000/);
  assert.ok(!documentError(new Error("private document details"), 15000).includes("private"));
});
