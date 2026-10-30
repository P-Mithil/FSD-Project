import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateDocxBytes, extractDocxText } from "../src/extractDocxText.js";
const bytes = new Uint8Array(
  await readFile(new URL("./fixtures/resume.docx", import.meta.url)),
);
const file = {
  name: "resume.docx",
  size: bytes.length,
  arrayBuffer: async () =>
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
};
test("DOCX raw text extraction preserves actual resume text", async () => {
  validateDocxBytes(file, bytes);
  const text = await extractDocxText(file);
  assert.match(text, /Frontend Developer/);
  assert.match(text, /Skills: React, JavaScript, CSS/);
  assert.ok(!text.includes("<w:"));
});
test("invalid, renamed, oversized and decompression-bomb DOCX archives are rejected", () => {
  assert.throws(
    () => validateDocxBytes(file, new TextEncoder().encode("not a DOCX")),
    /INVALID_DOCX/,
  );
  assert.throws(
    () => validateDocxBytes({ ...file, name: "resume.zip" }, bytes),
    /INVALID_DOCX/,
  );
  assert.throws(
    () => validateDocxBytes({ ...file, size: 6 * 1024 * 1024 }, bytes),
    /FILE_TOO_LARGE/,
  );
  const bomb = bytes.slice();
  const view = new DataView(bomb.buffer);
  for (let at = 0; at < bomb.length - 46; at++)
    if (view.getUint32(at, true) === 0x02014b50) {
      view.setUint32(at + 24, 30 * 1024 * 1024, true);
      break;
    }
  assert.throws(() => validateDocxBytes(file, bomb), /DOCX_TOO_LARGE/);
});
