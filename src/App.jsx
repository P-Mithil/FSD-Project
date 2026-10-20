import { useState } from "react";
import Upload from "./pages/Upload.jsx";
import { ReviewResults } from "./components/ReviewResults.jsx";
import sample from "./sampleAnalysis.json";

export default function App() {
  const [text, setText] = useState({ resume: "", job: "" });
  const [showSample, setShowSample] = useState(false);
  function updateText(kind, value) {
    setText(prev => ({ ...prev, [kind]: value }));
    setShowSample(false);
  }

  const path = window.location.pathname;
  if (path === "/" || path === "/analyze") {
    return (
      <>
        <Upload text={text} onTextChange={updateText} onShowDemo={() => setShowSample(value => !value)} showSample={showSample} />
        <ReviewResults
          analysis={showSample ? sample.analysis : null}
          isDemo={showSample}
          resumeText={showSample ? sample.resumeText : text.resume}
          jobDescription={showSample ? sample.jobDescription : text.job}
        />
      </>
    );
  }
  return (
    <main>
      <h1>Page not found</h1>
      <a href="/analyze">Open resume upload</a>
    </main>
  );
}
