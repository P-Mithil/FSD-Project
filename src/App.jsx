import { useState } from "react";
import Upload from "./pages/Upload.jsx";

export default function App() {
  const [text, setText] = useState({ resume: "", job: "" });
  function updateText(kind, value) {
    setText(prev => ({ ...prev, [kind]: value }));
  }

  const path = window.location.pathname;
  if (path === "/" || path === "/analyze") {
    return <Upload text={text} onTextChange={updateText} />;
  }
  return (
    <main>
      <h1>Page not found</h1>
      <a href="/analyze">Open resume upload</a>
    </main>
  );
}
