import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { validatePdfBytes } from "./pdfValidation.js";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MAX_PAGES = 20;

export async function extractPdfText(file) {
  const fileBytes = await file.arrayBuffer();
  validatePdfBytes(file, new Uint8Array(fileBytes));
  const loadingTask = getDocument({ data: fileBytes });
  try {
    const pdf = await loadingTask.promise;
    if (pdf.numPages > MAX_PAGES) {
      throw new Error("TOO_MANY_PAGES");
    }

    const pages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => (item.str || "") + (item.hasEOL ? "\n" : " "))
        .join("");
      pages.push(pageText);
    }

    return pages
      .join("\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } finally {
    await loadingTask.destroy();
  }
}
