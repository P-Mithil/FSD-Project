import { useRef, useState } from "react";
import { DocumentInput } from "../components/DocumentInput.jsx";
import { MAX_FILE_BYTES } from "../pdfValidation.js";
import "../Upload.css";

export default function Upload() {
  const [text, setText] = useState({ resume: "", job: "" });
  const [files, setFiles] = useState({ resume: "", job: "" });
  const [errors, setErrors] = useState({ resume: "", job: "" });
  const [reading, setReading] = useState({ resume: false, job: false });
  const uploads = useRef({ resume: 0, job: 0 });
  const error = Object.values(errors).filter(Boolean).join(" ");

  function editText(kind, value) {
    uploads.current[kind]++;
    setText(prev => ({ ...prev, [kind]: value }));
    setFiles(prev => ({ ...prev, [kind]: "" }));
    setErrors(prev => ({ ...prev, [kind]: "" }));
    setReading(prev => ({ ...prev, [kind]: false }));
  }

  async function selectFile(kind, event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const version = ++uploads.current[kind];
    setErrors(prev => ({ ...prev, [kind]: "" }));
    setReading(prev => ({ ...prev, [kind]: false }));
    const isDocx = file.name.toLowerCase().endsWith(".docx");
    const limit = kind === "resume" ? 15000 : 12000;
    try {
      if (!isDocx && !file.name.toLowerCase().endsWith(".pdf")) {
        throw new Error("INVALID_TYPE");
      }
      if (!file.size) throw new Error("NO_TEXT");
      if (file.size > MAX_FILE_BYTES) throw new Error("FILE_TOO_LARGE");
      setReading(prev => ({ ...prev, [kind]: true }));
      let value;
      if (isDocx) {
        const { extractDocxText } = await import("../extractDocxText.js");
        value = await extractDocxText(file);
      } else {
        const { extractPdfText } = await import("../extractPdfText.js");
        value = await extractPdfText(file);
      }
      if (version !== uploads.current[kind]) return;
      if (!value.trim()) throw new Error("NO_TEXT");
      if (value.length > limit) throw new Error("TOO_LONG");
      setText(prev => ({ ...prev, [kind]: value }));
      setFiles(prev => ({ ...prev, [kind]: file.name }));
    } catch (err) {
      if (version !== uploads.current[kind]) return;
      const messages = {
        INVALID_TYPE: "Please choose a PDF or DOCX document.",
        INVALID_PDF: "This PDF could not be read. Choose a valid text-based PDF or paste the text.",
        INVALID_DOCX: "This DOCX could not be read. Choose a valid document or paste the text.",
        DOCX_TOO_LARGE: "This DOCX expands to too much content. Choose a simpler document or paste the text.",
        FILE_TOO_LARGE: "Please choose a document of up to 5 MB.",
        TOO_MANY_PAGES: "Please choose a PDF of 20 pages or fewer.",
        NO_TEXT: "No readable text was found. Choose a text-based document or paste the text.",
        TOO_LONG: `Use up to ${limit.toLocaleString()} characters for this document.`,
      };
      const label = kind === "resume" ? "Resume" : "Job description";
      const message = messages[err.message] || "This document could not be read. Try another file or paste the text.";
      setErrors(prev => ({ ...prev, [kind]: `${label}: ${message}` }));
    } finally {
      if (version === uploads.current[kind]) {
        setReading(prev => ({ ...prev, [kind]: false }));
      }
    }
  }

  return (
    <main className="upload-page">
      <section className="panel-section" aria-labelledby="upload-title">
        <div className="section-heading">
          <p className="eyebrow">Analyze</p>
          <h2 id="upload-title">Two documents. One clearer direction.</h2>
          <p>Upload a PDF or DOCX, or paste text for each document. You can edit extracted text below.</p>
        </div>
        <div className="input-grid">
          <DocumentInput
            kind="resume"
            title="Resume"
            value={text.resume}
            fileName={files.resume}
            reading={reading.resume}
            allowDocx
            limit={15000}
            onFileChange={selectFile}
            onTextChange={editText}
          />
          <DocumentInput
            kind="job"
            title="Job description"
            value={text.job}
            fileName={files.job}
            reading={reading.job}
            allowDocx
            limit={12000}
            onFileChange={selectFile}
            onTextChange={editText}
          />
        </div>
        {error ? <p className="error-box" role="alert">{error}</p> : null}
        {text.resume.length > 15000 || text.job.length > 12000 ? (
          <p className="error-box" role="alert">Use up to 15,000 characters for your resume and 12,000 for the job description.</p>
        ) : null}
        <div className="action-row">
          <button className="button" type="button" disabled title="Analysis is not connected in this interface milestone.">Analyze Resume</button>
          <button className="button button-secondary" type="button" disabled title="Sample results are not connected in this interface milestone.">Show sample analysis</button>
        </div>
        <p className="fine-print">Your documents stay in this browser. This page does not send an analysis request.</p>
      </section>
    </main>
  );
}
