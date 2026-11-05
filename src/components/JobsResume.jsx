import { useEffect, useRef, useState } from "react";
import Jobs from "../pages/Jobs.jsx";
import { readDocument, documentError } from "../readDocument.js";

export default function JobsResume({ resumeText, onTextChange, session }) {
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const uploads = useRef(0);
  useEffect(() => () => { uploads.current++; }, []);

  function editText(_kind, value) {
    uploads.current += 1;
    onTextChange("resume", value);
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
    setReading(true);
    try {
      const text = await readDocument(file, 15000);
      if (version !== uploads.current) return;
      onTextChange("resume", text);
      setFileName(file.name);
    } catch (failure) {
      if (version !== uploads.current) return;
      setError(documentError(failure, 15000));
    } finally {
      if (version === uploads.current) setReading(false);
    }
  }

  return (
    <div className="jobs-page">
      <main className="jobs-matcher">
        <Jobs
          session={session}
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
      </footer>
    </div>
  );
}
