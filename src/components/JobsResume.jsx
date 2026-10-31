import { useRef, useState } from "react";
import Jobs from "../pages/Jobs.jsx";
import { MAX_FILE_BYTES } from "../pdfValidation.js";

export default function JobsResume() {
  const [resumeText, setResumeText] = useState("");
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const uploads = useRef(0);
  const session = useRef({ responses: new Map(), retryAt: 0 });

  function editText(_kind, value) {
    uploads.current += 1;
    setResumeText(value);
    setFileName("");
    setReading(false);
    setError("");
  }

  async function uploadFile(_kind, event) {
    const input = event.target;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    const version = ++uploads.current;
    setError("");
    setReading(false);
    const isDocx = file.name.toLowerCase().endsWith(".docx");
    if (!(isDocx || file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) {
      setError("Please upload a PDF or DOCX resume.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("This file is too large. Please upload a document smaller than 5 MB.");
      return;
    }

    setReading(true);
    try {
      let text;
      if (isDocx) {
        const { extractDocxText } = await import("../extractDocxText.js");
        text = await extractDocxText(file);
      } else {
        const { extractPdfText } = await import("../extractPdfText.js");
        text = await extractPdfText(file);
      }
      if (version !== uploads.current) return;
      if (!text.trim()) throw new Error("NO_TEXT");
      if (text.length > 15000) throw new Error("TOO_LONG");
      setResumeText(text);
      setFileName(file.name);
    } catch (failure) {
      if (version !== uploads.current) return;
      const messages = {
        INVALID_PDF: "This file does not contain a valid PDF. Upload a text-based PDF or paste the resume text.",
        INVALID_DOCX: "This file is not a readable DOCX document. Upload a valid document or paste the resume text.",
        DOCX_TOO_LARGE: "This DOCX expands to too much content. Upload a simpler document or paste the resume text.",
        FILE_TOO_LARGE: "This file is too large. Please upload a document smaller than 5 MB.",
        TOO_MANY_PAGES: "Please upload a PDF of 20 pages or fewer.",
        NO_TEXT: "This document has no readable text. Upload a text-based document or paste the resume text.",
        TOO_LONG: "This document is too long. Use up to 15,000 characters.",
      };
      setError(messages[failure.message] || "We could not read this document. Try another file or paste the resume text.");
    } finally {
      if (version === uploads.current) setReading(false);
    }
  }

  return (
    <div className="jobs-page">
      <header className="jobs-header">
        <a className="jobs-logo" href="/jobs">Resume Mate</a>
        <span>Live Jobs</span>
      </header>
      <main className="jobs-matcher">
        <Jobs
          session={session.current}
          resumeText={resumeText}
          fileName={fileName}
          reading={reading}
          onFileChange={uploadFile}
          onTextChange={editText}
          errorMessage={error}
          clearError={() => setError("")}
        />
      </main>
      <footer className="jobs-footer">
        <p>Resume Mate</p>
        <p>Live Indian technology jobs · Dev Global Jobs</p>
      </footer>
    </div>
  );
}
