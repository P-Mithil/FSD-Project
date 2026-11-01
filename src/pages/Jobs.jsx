import { useEffect, useRef, useState } from "react";
import { DocumentInput } from "../components/DocumentInput.jsx";
import { retryAfterSeconds } from "../retry.js";
import "../Jobs.css";

const cities = ["Bengaluru", "Hyderabad", "Pune", "Chennai", "Mumbai", "Delhi"];
const SCORE_LABELS = {
  strong: "Strong match",
  moderate: "Moderate match",
  weak: "Low match",
};

export default function Jobs({
  session,
  resumeText,
  fileName,
  reading,
  onFileChange,
  onTextChange,
  errorMessage,
  clearError,
}) {
  const [filters, setFilters] = useState({
    city: "",
    type: "any",
    days: "30",
    level: "all",
  });
  const [otherCity, setOtherCity] = useState("");
  const [resumeOpen, setResumeOpen] = useState(!resumeText.trim());
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retryAt, setRetryAt] = useState(session.retryAt || 0);
  const [clock, setClock] = useState(Date.now());
  const controller = useRef(null);
  const query = {
    ...filters,
    city: filters.city === "other" ? otherCity.trim() : filters.city,
  };
  const filterKey = JSON.stringify(query);
  const cooldown = Math.max(0, Math.ceil((retryAt - clock) / 1000));

  useEffect(() => {
    if (retryAt <= Date.now()) return;
    const timer = setInterval(() => {
      setClock(Date.now());
      if (Date.now() >= retryAt) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [retryAt]);

  function setCooldown(response, body) {
    const seconds =
      retryAfterSeconds(response.headers.get("Retry-After")) ??
      body?.retryAfterSeconds ??
      (response.status === 429 ? 60 : 0);
    if (seconds > 0) {
      session.retryAt = Math.max(
        session.retryAt || 0,
        Date.now() + seconds * 1000,
      );
      setRetryAt(session.retryAt);
      setClock(Date.now());
    }
  }

  async function getJobs() {
    if (reading || session.retryAt > Date.now()) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    const timer = setTimeout(() => request.abort(), 100000);
    setBusy(true);
    setError("");
    clearError();
    if (resumeText.trim()) setResumeOpen(false);
    try {
      const text = resumeText.trim();
      const url = text ? "/api/jobs/match" : `/api/jobs?${new URLSearchParams(query)}`;
      const options = { signal: request.signal };
      if (text) {
        options.method = "POST";
        options.headers = { "Content-Type": "application/json" };
        options.body = JSON.stringify({ resumeText: text, filters: query });
      }
      const response = await fetch(url, options);
      const body = await response.json().catch(() => null);
      if (controller.current !== request) return;
      setCooldown(response, body);
      if (!response.ok)
        throw new Error(
          body?.error || "The jobs service is unavailable. Please retry later.",
        );
      if (!body || (!Array.isArray(body.results) && !Array.isArray(body.jobs)))
        throw new Error("The jobs service returned an unexpected response.");
      const next = body.results
        ? body
        : {
            ...body,
            results: [],
            explore: body.jobs.map((job) => ({
              job,
              reason: "Add a resume to calculate compatibility.",
            })),
          };
      setData(next);
      if (!body.warning && !body.retryAfterSeconds) {
        if (session.responses.size >= 10)
          session.responses.delete(session.responses.keys().next().value);
        session.responses.set(filterKey, {
          data: next,
          expires: Date.now() + 10 * 60000,
        });
      }
    } catch (failure) {
      if (controller.current === request && !request.signal.aborted)
        setError(failure.message);
      else if (controller.current === request)
        setError(
          "The search timed out. Existing results are preserved. Retry manually.",
        );
    } finally {
      clearTimeout(timer);
      if (controller.current === request) setBusy(false);
    }
  }

  useEffect(() => {
    // The timer debounces typing. Cooldown expiry and hover never trigger requests.
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setError("");
    if (session.resumeText !== resumeText.trim()) {
      session.responses.clear();
      session.resumeText = resumeText.trim();
    }
    const cached = session.responses.get(filterKey);
    setData(cached?.expires > Date.now() ? cached.data : null);
    if (
      reading ||
      !resumeText.trim() ||
      resumeText.length > 15000 ||
      (filters.city === "other" && !otherCity.trim()) ||
      cached?.expires > Date.now()
    )
      return;
    const timer = setTimeout(() => getJobs(), 900);
    return () => {
      clearTimeout(timer);
      controller.current?.abort();
    };
  }, [resumeText, filterKey, reading]);
  useEffect(() => () => controller.current?.abort(), []);

  const results = data?.results || [];
  const explore = data?.explore || [];
  const jobs = [...results, ...explore].sort((a, b) =>
    (b.analysis?.matchScore ?? -1) - (a.analysis?.matchScore ?? -1) ||
    (Date.parse(b.job.postedAt) || 0) - (Date.parse(a.job.postedAt) || 0) ||
    a.job.id.localeCompare(b.job.id),
  );
  return (
    <section
      className="panel-section smart-jobs"
      aria-labelledby="live-jobs-title"
    >
      <div className="smart-jobs-heading">
        <div>
          <p className="eyebrow">RESUME MATE · LIVE JOBS</p>
          <h1 id="live-jobs-title">Your skills. Your next move.</h1>
          <p>
            Upload once. Discover Indian technology jobs ranked by your resume.
          </p>
        </div>
        <span className="smart-india-pill">IN · India</span>
      </div>
      <details
        className="resume-drawer"
        open={resumeOpen}
        onToggle={(event) => setResumeOpen(event.currentTarget.open)}
      >
        <summary>
          <span>
            <strong>Your resume</strong>
            <small>
              {resumeText.trim()
                ? `${fileName || "Session resume"} · ${resumeText.length.toLocaleString()} characters`
                : "PDF, DOCX or text · used for job matching"}
            </small>
          </span>
          <span className="accent-text">
            {resumeText.trim() ? "Review / replace +" : "Add resume +"}
          </span>
        </summary>
        <DocumentInput
          prefix="matcher-"
          kind="resume"
          title="Resume"
          value={resumeText}
          fileName={fileName}
          reading={reading}
          allowDocx
          limit={15000}
          onFileChange={onFileChange}
          onTextChange={onTextChange}
        />
      </details>
      <form
        className="smart-job-filters"
        onSubmit={(event) => {
          event.preventDefault();
          getJobs();
        }}
      >
        <label>
          Location
          <select
            aria-label="Job location"
            value={filters.city}
            onChange={(event) =>
              setFilters({ ...filters, city: event.target.value })
            }
          >
            <option value="">All India</option>
            {cities.map((city) => (
              <option key={city}>{city}</option>
            ))}
            <option value="remote">India-eligible remote</option>
            <option value="other">Other Indian city</option>
          </select>
        </label>
        {filters.city === "other" ? (
          <label>
            City name
            <input
              value={otherCity}
              onChange={(event) => setOtherCity(event.target.value)}
              maxLength={60}
              placeholder="e.g. Ahmedabad"
            />
          </label>
        ) : null}
        <label>
          Job type
          <select
            aria-label="Job type"
            value={filters.type}
            onChange={(event) =>
              setFilters({ ...filters, type: event.target.value })
            }
          >
            <option value="any">All job types</option>
            <option value="internship">Internship</option>
            <option value="full-time">Full-time</option>
            <option value="remote">Remote</option>
          </select>
        </label>
        <label>
          Posted within
          <select
            aria-label="Posting date"
            value={filters.days}
            onChange={(event) =>
              setFilters({ ...filters, days: event.target.value })
            }
          >
            <option value="1">24 hours</option>
            <option value="3">3 days</option>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
            <option value="any">Any date / date unavailable</option>
          </select>
        </label>
        <label>
          Experience
          <select
            aria-label="Job experience"
            value={filters.level}
            onChange={(event) =>
              setFilters({ ...filters, level: event.target.value })
            }
          >
            <option value="all">Match my experience</option>
            <option value="fresher">Freshers / junior roles</option>
          </select>
        </label>
        <button
          className="button"
          disabled={
            busy ||
            reading ||
            cooldown > 0 ||
            resumeText.length > 15000 ||
            (filters.city === "other" && !otherCity.trim())
          }
        >
          {busy
            ? "Finding your fit…"
            : resumeText.trim()
              ? "Find my matches ↗"
              : "Browse Indian jobs ↗"}
        </button>
      </form>
      {errorMessage || error ? (
        <p className="error-box" role="alert">
          {errorMessage || error}
        </p>
      ) : null}
      {cooldown > 0 ? (
        <p className="match-cooldown" role="status">
          The jobs provider is rate limited. Retry in{" "}
          <span aria-live="off">{cooldown} seconds</span>. Existing results
          remain available. No automatic retry.
        </p>
      ) : null}
      {busy ? (
        <p className="smart-loading" role="status">
          Reading your skills, checking full job descriptions, and calculating
          compatibility…
        </p>
      ) : null}
      {data?.warning ? (
        <p className="match-warning" role="status">
          {data.warning}
        </p>
      ) : null}
      {data?.profile ? (
        <div className="smart-profile">
          <div>
            <span className="eyebrow">From your resume</span>
            <strong>
              {data.profile.roles.join(" · ") || "Role not established"}
            </strong>
          </div>
          <div className="smart-profile-skills">
            {data.profile.skills.slice(0, 8).map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
          </div>
          <small>
            {data.profile.experienceYears === null
              ? "Work experience not established; no experience credit awarded."
              : `${data.profile.experienceYears} years of stated work experience`}
          </small>
        </div>
      ) : null}
      <section className="smart-results" aria-labelledby="smart-recommended">
        <div className="smart-results-heading">
          <h2 id="smart-recommended">
            Jobs <span>{jobs.length}</span>
          </h2>
        </div>
        {!jobs.length && !busy ? (
          <div className="smart-empty">
            <h3>
              {!resumeText.trim()
                ? "Start with your resume."
                : "No jobs matched yet."}
            </h3>
            <p>
              {!resumeText.trim()
                ? "Upload or paste your resume to discover your best opportunities. You can also browse jobs first."
                : "No jobs matched yet. Compare your resume to discover your best opportunities. Try a wider date window or All India if this source pool has no suitable roles."}
            </p>
          </div>
        ) : null}
        <div className="smart-job-list">
          {jobs.map((item) => (
            <JobCard
              key={item.job.id}
              {...item}
              resumeSkills={data.profile?.skills || []}
            />
          ))}
        </div>
      </section>
    </section>
  );
}

function JobCard({ job, analysis, reason, resumeSkills = [] }) {
  const score = Number.isFinite(analysis?.matchScore)
    ? analysis.matchScore
    : null;
  const incomplete = score === null || Boolean(analysis?.partial);
  const [hovered, setHovered] = useState(false);
  const [tapped, setTapped] = useState(false);
  const [focused, setFocused] = useState(false);
  const [details, setDetails] = useState(false);
  const open = score !== null && (hovered || tapped || focused);
  const tone = score >= 80 ? "strong" : score >= 50 ? "moderate" : "weak";
  const matched = analysis?.matchedSkills || [];
  return (
    <article
      className={`smart-job ${open ? "score-open" : ""} score-${tone}`}
      tabIndex={0}
      aria-label={`${job.title} at ${job.company}${score === null ? ", match unavailable" : `, estimated compatibility ${score} percent`}`}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={(event) => {
        if (event.target.matches(":focus-visible")) setFocused(true);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false);
          setTapped(false);
        }
      }}
      onClick={(event) => {
        if (!event.target.closest("a,button,details")) setTapped(!tapped);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setTapped(false);
          setFocused(false);
          setHovered(false);
        }
        if (
          event.target === event.currentTarget &&
          ["Enter", " "].includes(event.key)
        ) {
          event.preventDefault();
          setTapped(!tapped);
        }
      }}
    >
      <div className="smart-job-row">
        <div className="smart-company-mark" aria-hidden="true">
          {job.logo ? (
            <img src={job.logo} alt="" loading="lazy" />
          ) : (
            job.company
              .split(/\s+/)
              .slice(0, 2)
              .map((word) => word[0])
              .join("")
          )}
        </div>
        <div className="smart-job-copy">
          <h3>{job.title}</h3>
          <p>{job.company}</p>
          {analysis?.partial ? <small className="smart-skills-note">Estimated score · incomplete description</small> : null}
          <div className="smart-job-meta">
            <span>
              {job.location || "Location not supplied"}
              {job.remote && !/remote/i.test(job.location) ? " · Remote" : ""}
            </span>
            <span>{job.jobType}</span>
            {job.salary ? <span>{job.salary}</span> : null}
            <time dateTime={job.postedAt || undefined}>
              {job.postedAt
                ? new Date(job.postedAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })
                : "Date unavailable"}
            </time>
          </div>
        </div>
        <div className="smart-score-slot">
          {score !== null ? (
            <>
              <span className="smart-score-hint">
                <strong>{score}% match</strong>
                <br />
                Hover or tap
              </span>
              <div
                className="smart-score-ring"
                role="img"
                aria-label={`Estimated compatibility: ${score} percent`}
                aria-hidden={!open}
              >
                <svg viewBox="0 0 100 100" aria-hidden="true">
                  <circle className="smart-ring-track" cx="50" cy="50" r="42" />
                  <circle
                    className="smart-ring-progress"
                    cx="50"
                    cy="50"
                    r="42"
                    pathLength="100"
                    style={{
                      "--match-offset": 100 - score,
                      strokeDashoffset: open ? 100 - score : 100,
                    }}
                  />
                </svg>
                <strong>
                  {score}
                  <small>%</small>
                </strong>
              </div>
            </>
          ) : (
            <span className="smart-no-score">Score unavailable</span>
          )}
        </div>
        <a
          className="smart-apply"
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Apply ↗
        </a>
      </div>
      {score !== null ? (
        <div className="smart-score-tooltip" aria-hidden={!open}>
          <strong>{SCORE_LABELS[tone]}</strong>
          <span>
            Matched: {matched.slice(0, 3).join(", ") || "None verified"}
          </span>
          <span>
            Missing:{" "}
            {analysis.missingSkills.slice(0, 2).join(", ") || "None identified"}
          </span>
        </div>
      ) : null}
      <details
        className="smart-score-details"
        open={details}
        onToggle={(event) => setDetails(event.currentTarget.open)}
      >
        <summary>
          {score !== null ? "Why this match?" : "Why unavailable?"}
        </summary>
        <p>
          {(score === null ? reason : analysis?.explanation) ||
            analysis?.explanation ||
            "No sufficient verified requirements were available to calculate a score."}
        </p>
        {analysis?.requiredSkills?.length ? (
          <div className="smart-skill-comparison">
            <SkillList
              title={incomplete ? "Skills identified in available requirements" : "Skills this job requires"}
              skills={analysis.requiredSkills || []}
              empty="Refresh your matches to load the complete required skill list."
            />
            <SkillList
              title="You already match"
              skills={matched}
              tone="matched"
              empty="No required technical skills were matched."
            />
            <SkillList
              title={incomplete ? "Not demonstrated in your resume" : "Skills to build or demonstrate"}
              skills={analysis.missingSkills || []}
              tone="missing"
              empty={incomplete ? "No gaps found in this partial evidence; the full requirements are not verified." : "No gaps found among the extracted technical requirements."}
            />
          </div>
        ) : null}
        {incomplete ? (
          <>
            <p className="smart-skills-note">Partial evidence only. Additional skills or eligibility requirements may be missing from the source text.</p>
            <details className="smart-calculation">
              <summary>Available job description</summary>
              <p style={{ whiteSpace: "pre-wrap" }}>{job.description || "The provider did not supply readable job-description text. Open the source listing for requirements."}</p>
            </details>
          </>
        ) : null}
        {resumeSkills.length ? (
          <SkillList
            title="All skills found in your resume"
            skills={resumeSkills}
            tone="resume"
          />
        ) : null}
        {score !== null ? (
          <p className="smart-skills-note">
            Lists cover recognized technical skills in the available text. “Or”
            means an accepted alternative. Missing means your resume does not
            yet demonstrate it.
          </p>
        ) : null}
        {analysis?.breakdown ? (
          <details className="smart-calculation">
            <summary>How was the percentage calculated?</summary>
            <ul>
              {analysis.breakdown.map((row) => (
                <li key={row.id}>
                  {row.label}:{" "}
                  {row.applicable
                    ? `${row.effectiveWeight.toFixed(2)}% weight × ${(row.credit * 100).toFixed(0)}% credit = ${row.contribution.toFixed(2)} points. ${row.evidence}`
                    : "Not specified / not applicable; weight redistributed."}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <p>
          {score === null ? "No match percentage assigned. Check the source for complete requirements." : "Estimated resume compatibility, not hiring probability. Confirm requirements on the source."}
        </p>
      </details>
    </article>
  );
}

function SkillList({ title, skills, tone = "required", empty }) {
  return (
    <section
      className={`smart-skill-group skill-tone-${tone}`}
      aria-label={title}
    >
      <h4>
        {title} <span>{skills.length}</span>
      </h4>
      {skills.length ? (
        <ul>
          {skills.map((skill) => (
            <li key={skill}>{skill}</li>
          ))}
        </ul>
      ) : (
        <p>{empty}</p>
      )}
    </section>
  );
}
