import { useEffect, useState } from "react";
import "../Home.css";
import { Preview } from "../components/Preview.jsx";

const SPLINE_SCENE =
  "https://prod.spline.design/NSunQWiBbFevQ7m4/scene.splinecode";

export default function Home() {
  return (
    <main className="home-page">
      <Hero />
      <FeatureCards />
      <Preview />
      <About />
    </main>
  );
}

function Hero() {
  const [glow, setGlow] = useState({ x: 160, y: 220, visible: false });

  useEffect(() => {
    if (document.querySelector('script[data-spline-viewer]')) return;
    const script = document.createElement("script");
    script.type = "module";
    script.src = "https://cdn.spline.design/@splinetool/viewer@2.0.114/build/spline-viewer.js";
    script.dataset.splineViewer = "true";
    document.head.appendChild(script);
  }, []);

  function moveGlow(event) {
    const box = event.currentTarget.getBoundingClientRect();
    setGlow({ x: event.clientX - box.left, y: event.clientY - box.top, visible: true });
  }

  return (
    <section className="hero" id="home" onPointerMove={moveGlow} onPointerLeave={() => setGlow(current => ({ ...current, visible: false }))}>
      <div
        className={glow.visible ? "hero-glow is-on" : "hero-glow"}
        style={{ left: glow.x, top: glow.y }}
        aria-hidden="true"
      />
      <div className="hero-copy">
        <h1>
          <span>Resume</span>
          <span>Mate</span>
        </h1>
        <p className="hero-note">
          The score is an estimate. Nothing is invented.
        </p>
        <div className="hero-actions">
          <a className="button" href="/analyze">
            Analyze My Resume
          </a>
          <a className="button button-secondary" href="#about">
            How it works
          </a>
        </div>
      </div>
      <div className="bot-frame" aria-hidden="true">
        <spline-viewer url={SPLINE_SCENE} background="transparent" />
      </div>
      <aside className="hero-side">
        <h2>See what lines up</h2>
        <p>
          Upload a resume and paste a job description. Resume Mate reads the
          text and shows the skills that match, the ones that are missing, and
          three changes worth making.
        </p>
        <div className="hero-stats">
          <article>
            <strong>0–100</strong>
            <span>estimated match</span>
          </article>
          <article>
            <strong>Top 3</strong>
            <span>changes to try</span>
          </article>
        </div>
      </aside>
    </section>
  );
}

function FeatureCards() {
  return (
    <section
      className="feature-cards panel-section"
      aria-label="Choose a feature"
    >
      <article className="card feature-card">
        <p className="eyebrow">01 · Resume Analyzer</p>
        <h2>Make your next version clearer.</h2>
        <p>
          Upload a resume and job description to discover your compatibility,
          missing skills, and improvements.
        </p>
        <a className="button" href="/analyze">
          Analyze Resume
        </a>
      </article>
      <article className="card feature-card">
        <p className="eyebrow">02 · AI Job Matcher</p>
        <h2>Find where your skills fit.</h2>
        <p>
          Upload your resume and discover real job opportunities ranked by how
          well they match your skills.
        </p>
        <span className="button button-accent" aria-disabled="true" title="Live Jobs will be available after its feature is integrated.">
          Find Matching Jobs
        </span>
      </article>
    </section>
  );
}

function About() {
  return (
    <section className="about" id="about">
      <div className="about-intro">
        <div className="section-heading">
          <p className="eyebrow">About</p>
          <h2>
            Know your gaps.
            <br />
            Find your next opportunity.
          </h2>
          <p>
            Resume Mate connects two parts of your job search: understanding how
            your resume fits a role, and discovering jobs worth a closer look.
          </p>
        </div>
        <p className="about-note">
          Start with the experience you already have. Get practical feedback
          without invented achievements or promises of a job.
        </p>
      </div>
      <div className="about-features">
        <article className="about-feature">
          <p className="eyebrow">01 · Resume Analyzer</p>
          <h3>A clearer resume, one role at a time.</h3>
          <p>
            Add your resume and a job description as text or PDFs. Review the
            extracted text, then run your analysis.
          </p>
          <ul>
            <li>See matched, partially matched, and missing qualifications.</li>
            <li>Inspect a weighted score and the evidence behind it.</li>
            <li>
              Review resume annotations and three prioritized improvements.
            </li>
          </ul>
          <a className="about-link" href="/analyze">
            Analyze your resume ↗
          </a>
        </article>
        <article className="about-feature">
          <p className="eyebrow">02 · AI Job Matcher</p>
          <h3>Explore first. Compare when you're ready.</h3>
          <p>
            Browse India-eligible technology jobs with source links. Add your
            resume to compare suitable listings against your experience.
          </p>
          <ul>
            <li>
              Recommendations include only jobs with a calculated match score.
            </li>
            <li>
              Evaluated jobs rank by compatibility; other jobs stay available to
              explore.
            </li>
            <li>
              Inspect matched skills and gaps before applying on the original
              source.
            </li>
          </ul>
          <span className="about-link" aria-disabled="true" title="Live Jobs will be available after its feature is integrated.">
            Explore job opportunities ↗
          </span>
        </article>
      </div>
      <dl className="about-principles">
        <div>
          <dt>Evidence before estimates</dt>
          <dd>
            Scores reflect the available resume and job evidence. They are
            estimates, not official ATS scores or hiring decisions.
          </dd>
        </div>
        <div>
          <dt>Your original stays yours</dt>
          <dd>
            PDF text is extracted in your browser. Suggested edits stay separate
            so you can decide what accurately reflects your experience.
          </dd>
        </div>
        <div>
          <dt>No account needed</dt>
          <dd>
            Compare when you choose. Job matching reuses results temporarily in
            memory, and browsing remains available when AI is busy.
          </dd>
        </div>
      </dl>
    </section>
  );
}
