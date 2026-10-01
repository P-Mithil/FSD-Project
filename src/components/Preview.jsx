import { useEffect, useRef, useState } from "react";

const highlights = [
  ["0–100", "estimated match"], ["Skills", "that already line up"],
  ["Gaps", "the job still asks for"], ["Top 3", "changes worth making"],
];

export function Preview() {
  const frame = useRef(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    function scroll() {
      const box = frame.current.getBoundingClientRect();
      setProgress(Math.max(0, Math.min(1, (window.innerHeight - box.top) / (window.innerHeight + box.height))));
    }
    scroll();
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", scroll);
    return () => {
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", scroll);
    };
  }, []);

  return (
    <section className="scroll-preview" id="preview" aria-label="Resume Mate check" ref={frame} style={{ "--progress": progress }}>
      <div className="mate-corners" aria-hidden="true" />
      <div className="preview-content">
        <div className="preview-heading">
          <p className="eyebrow">Resume Mate</p>
          <h2>The check,<br />written like a resume</h2>
        </div>
        <div className="preview-frame">
          <article className="preview-paper">
            <header>
              <div><h3>Resume Mate</h3><p>Resume check · one job at a time</p></div>
              <p className="preview-privacy">PDF text stays in the browser<br />until you press Analyze</p>
            </header>
            <p className="preview-description">Reads the resume and the job description side by side. Marks what already fits, what is still missing, and the three edits that would make the next version clearer.</p>
            <ul className="preview-highlights">
              {highlights.map(([label, detail]) => <li key={label}><strong>{label}</strong><span>{detail}</span></li>)}
            </ul>
            <div className="preview-example">
              <p><strong>Before</strong>Worked on various web projects and know React.</p>
              <p><strong>Clearer</strong>Built a React page that reads a resume PDF in the browser and compares it with one job description.</p>
            </div>
            <p className="preview-note">Illustrative wording only. The score is an estimate, not an official ATS score. Nothing is added that the resume did not already say.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
