import { MAX_FILE_BYTES } from "./pdfValidation.js";

export async function readDocument(file, limit) {
  const docx = file.name.toLowerCase().endsWith(".docx");
  const pdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
  if (!docx && !pdf) throw new Error("INVALID_TYPE");
  if (!file.size) throw new Error("NO_TEXT");
  if (file.size > MAX_FILE_BYTES) throw new Error("FILE_TOO_LARGE");
  const text = docx
    ? await (await import("./extractDocxText.js")).extractDocxText(file)
    : await (await import("./extractPdfText.js")).extractPdfText(file);
  if (!text.trim()) throw new Error("NO_TEXT");
  if (text.length > limit) throw new Error("TOO_LONG");
  return text;
}

export function documentError(err, limit) {
  const messages = {
    INVALID_TYPE: "Please choose a PDF or DOCX document.",
    INVALID_PDF: "This PDF could not be read. Choose a valid text-based PDF or paste the text.",
    PASSWORD_PDF: "This PDF is password-protected. Choose an unlocked copy or paste the text.",
    INVALID_DOCX: "This DOCX could not be read. Choose a valid document or paste the text.",
    DOCX_TOO_LARGE: "This DOCX expands to too much content. Choose a simpler document or paste the text.",
    FILE_TOO_LARGE: "Please choose a document of up to 5 MB.",
    TOO_MANY_PAGES: "Please choose a PDF of 20 pages or fewer.",
    NO_TEXT: "No readable text was found. Choose a text-based document or paste the text.",
    TOO_LONG: `Use up to ${limit.toLocaleString()} characters for this document.`,
  };
  return messages[err.message] || "This document could not be read. Try another file or paste the text.";
}
