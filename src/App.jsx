import { useEffect, useRef, useState } from "react";
import Upload from "./pages/Upload.jsx";
import Home from "./pages/Home.jsx";
import { ReviewResults } from "./components/ReviewResults.jsx";
import sample from "./sampleAnalysis.json";
import { isAnalysisResult } from "./reviewAnalysis.js";
import { retryAfterSeconds } from "./retry.js";
import Navbar from "./components/Navbar.jsx";

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [text, setText] = useState({ resume: "", job: "" });
  const [showSample, setShowSample] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  const retryAt = useRef(0);
  useEffect(() => {
    function back() { setPath(window.location.pathname); }
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);

  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (["home", "about", "preview", "results"].includes(id)) {
      document.getElementById(id)?.scrollIntoView();
    }
  }, [path]);

  function navigate(event) {
    const link = event.target.closest?.("a[href]");
    if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target || link.hasAttribute("download")) return;
    const url = new URL(link.href);
    if (url.origin !== window.location.origin || !["/", "/analyze"].includes(url.pathname)) return;
    if (url.pathname === path && url.hash) return;
    event.preventDefault();
    window.history.pushState({}, "", url.pathname + url.hash);
    setPath(url.pathname);
    if (!url.hash) window.scrollTo({ top: 0, behavior: "instant" });
  }
  function updateText(kind, value) {
    request.current++;
    setText(prev => ({ ...prev, [kind]: value }));
    setShowSample(false);
    setAnalysis(null);
    setError("");
    setLoading(false);
  }

  async function analyze() {
    if (loading) return;
    const wait = Math.ceil((retryAt.current - Date.now()) / 1000);
    if (wait > 0) {
      setError(`Groq is rate-limited. Wait ${wait} seconds, then click Analyze Resume again.`);
      return;
    }
    const resumeText = text.resume.trim();
    const jobDescription = text.job.trim();
    if (!resumeText || !jobDescription) {
      setError("Add both your resume and job description before analyzing.");
      return;
    }
    if (resumeText.length > 15000 || jobDescription.length > 12000) {
      setError("Use up to 15,000 characters for the resume and 12,000 for the job description.");
      return;
    }
    if (resumeText.replace(/\s+/g, " ") === jobDescription.replace(/\s+/g, " ")) {
      setError("Both fields contain the same document. Add a job description in the second field.");
      return;
    }
    const version = ++request.current;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, jobDescription }),
        signal: AbortSignal.timeout(35000),
      });
      const data = await res.json().catch(() => null);
      if (version !== request.current) return;
      if (res.status === 429) {
        const seconds = retryAfterSeconds(res.headers.get("retry-after")) ?? 60;
        retryAt.current = Date.now() + seconds * 1000;
        setError(`Groq is rate-limited. Wait ${seconds} seconds, then click Analyze Resume again.`);
        return;
      }
      if (!res.ok) {
        setError(data?.error || "The analysis service could not process this request. Please try again.");
        return;
      }
      if (!isAnalysisResult(data, resumeText, jobDescription)) {
        setError("The AI response was not in the expected format. Please try again.");
        return;
      }
      setAnalysis(data);
      setShowSample(false);
    } catch (err) {
      if (version !== request.current) return;
      setError(err.name === "TimeoutError"
        ? "The analysis took too long. Please try again."
        : "Could not reach the analysis service. Check that the backend is running.");
    } finally {
      if (version === request.current) setLoading(false);
    }
  }

  return (
    <div onClick={navigate}>
      <Navbar path={path} />
      {path === "/" ? <Home /> : null}
      {path === "/analyze" ? <>
        <Upload
          text={text}
          onTextChange={updateText}
          onShowDemo={() => setShowSample(value => !value)}
          showSample={showSample}
          onAnalyze={analyze}
          loading={loading}
          error={error}
        />
        <ReviewResults
          analysis={showSample ? sample.analysis : analysis}
          isDemo={showSample}
          resumeText={showSample ? sample.resumeText : text.resume}
          jobDescription={showSample ? sample.jobDescription : text.job}
        />
      </> : null}
      {!["/", "/analyze"].includes(path) ? <main>
      <h1>Page not found</h1>
      <a href="/analyze">Open resume upload</a>
      </main> : null}
    </div>
  );
}
