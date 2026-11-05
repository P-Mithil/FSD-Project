import { useEffect, useRef, useState } from "react";
import { DocumentInput } from "../components/DocumentInput.jsx";
import { readDocument, documentError } from "../readDocument.js";
import "../Upload.css";

export default function Upload({ text, onTextChange, onAnalyze, loading = false, error = "" }) {
  const [files, setFiles] = useState({ resume: "", job: "" });
  const [errors, setErrors] = useState({ resume: "", job: "" });
  const [reading, setReading] = useState({ resume: false, job: false });
  const uploads = useRef({ resume: 0, job: 0 });
  useEffect(() => () => {
    uploads.current.resume++;
    uploads.current.job++;
  }, []);

  function editText(kind, value) {
    uploads.current[kind]++;
    onTextChange(kind, value);
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
    const limit = kind === "resume" ? 15000 : 12000;
    try {
      setReading(prev => ({ ...prev, [kind]: true }));
      const value = await readDocument(file, limit);
      if (version !== uploads.current[kind]) return;
      onTextChange(kind, value);
      setFiles(prev => ({ ...prev, [kind]: file.name }));
    } catch (err) {
      if (version !== uploads.current[kind]) return;
      setErrors(prev => ({ ...prev, [kind]: documentError(err, limit) }));
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
            error={errors.resume}
            disabled={loading}
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
            error={errors.job}
            disabled={loading}
            limit={12000}
            onFileChange={selectFile}
            onTextChange={editText}
          />
        </div>
        {error ? <p className="error-box" role="alert">{error}</p> : null}
        {loading ? <p className="fine-print" role="status">AI is analyzing your documents...</p> : null}
        <div className="action-row">
          <button className="button" type="button" onClick={onAnalyze} disabled={!onAnalyze || loading || reading.resume || reading.job} aria-busy={loading}>{loading ? "Analyzing..." : error ? "Try again" : "Analyze Resume"}</button>
        </div>
        <p className="fine-print">Documents are read in your browser. Both texts are sent for AI analysis only when you click Analyze Resume.</p>
      </section>
    </main>
  );
}
