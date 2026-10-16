import { useState } from "react";
import { DocumentInput } from "../components/DocumentInput.jsx";
import "../Upload.css";

export default function Upload() {
  const [text, setText] = useState({ resume: "", job: "" });
  const [files, setFiles] = useState({ resume: "", job: "" });
  const [error, setError] = useState("");

  function editText(kind, value) {
    setText({ ...text, [kind]: value });
  }

  function selectFile(kind, event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF document.");
      return;
    }
    if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      setError("Please choose a non-empty PDF of up to 5 MB.");
      return;
    }
    setFiles({ ...files, [kind]: file.name });
  }

  return (
    <main className="upload-page">
      <section className="panel-section" aria-labelledby="upload-title">
        <div className="section-heading">
          <p className="eyebrow">Analyze</p>
          <h2 id="upload-title">Two documents. One clearer direction.</h2>
          <p>Choose a PDF or paste text for each document.</p>
        </div>
        <div className="input-grid">
          <DocumentInput
            kind="resume"
            title="Resume"
            value={text.resume}
            fileName={files.resume && `${files.resume} selected. You can paste text below.`}
            limit={15000}
            onFileChange={selectFile}
            onTextChange={editText}
          />
          <DocumentInput
            kind="job"
            title="Job description"
            value={text.job}
            fileName={files.job && `${files.job} selected. You can paste text below.`}
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
