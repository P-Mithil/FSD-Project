import { useEffect, useState } from "react";
import { getJobs } from "../jobs.js";
import { filterJobs } from "../jobFilters.js";
import "./Jobs.css";
import "../Jobs.css";

const cities = ["Bengaluru", "Hyderabad", "Pune", "Chennai", "Mumbai", "Delhi"];
const initialFilters = { city: "", type: "any", days: "7", level: "all" };

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [filters, setFilters] = useState(initialFilters);
  const [query, setQuery] = useState(initialFilters);
  const [otherCity, setOtherCity] = useState("");
  const [visible, setVisible] = useState(8);

  useEffect(() => {
    const request = new AbortController();
    setLoading(true);
    setError("");
    getJobs(request.signal)
      .then((data) => { if (!request.signal.aborted) setJobs(data); })
      .catch((failure) => {
        if (!request.signal.aborted) {
          setError(failure.name === "TimeoutError"
            ? "The jobs service took too long to respond. Please try again later."
            : failure instanceof TypeError
              ? "Could not connect to the jobs service. Check your connection and try again later."
              : failure.message);
        }
      })
      .finally(() => { if (!request.signal.aborted) setLoading(false); });
    return () => request.abort();
  }, [reload]);

  function applyFilters() {
    setQuery({ ...filters, city: filters.city === "other" ? otherCity.trim() : filters.city });
    setVisible(8);
  }

  const results = filterJobs(jobs, query);
  return (
    <div className="jobs-page">
      <header className="jobs-header">
        <a className="jobs-logo" href="/jobs">Resume Mate</a>
        <span>Live Jobs</span>
      </header>
    <main className="panel-section smart-jobs" aria-labelledby="live-jobs-title">
      <div className="smart-jobs-heading">
        <div>
          <p className="eyebrow">RESUME MATE · LIVE JOBS</p>
          <h1 id="live-jobs-title">Your skills. Your next move.</h1>
          <p>Browse Indian technology jobs and inspect the details on their source.</p>
        </div>
        <span className="smart-india-pill">IN · India</span>
      </div>
      <form
        className="smart-job-filters"
        onSubmit={(event) => {
          event.preventDefault();
          applyFilters();
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
            <option value="all">All experience levels</option>
            <option value="fresher">Freshers / junior roles</option>
          </select>
        </label>
        <button
          className="button"
          disabled={
            loading ||
            (filters.city === "other" && !otherCity.trim())
          }
        >
          {loading ? "Loading jobs…" : "Browse Indian jobs ↗"}
        </button>
      </form>
      <p className="smart-source-note">
        A bounded source pool, filtered locally by city and date—not every vacancy in India.{" "}
        <a href="https://devglobaljobs.com" target="_blank" rel="noopener noreferrer">
          Powered by Dev Global Jobs
        </a>
      </p>
      <p className="smart-privacy">
        Listings are for browsing. Resume matching and compatibility scores are not available in this milestone.
      </p>
      {loading ? <p className="smart-loading" role="status">Loading live job listings…</p> : null}
      {error ? (
        <div className="error-box" role="alert">
          <p>{error}</p>
          <button className="button button-secondary" disabled={loading} onClick={() => setReload(reload + 1)}>
            Retry loading jobs
          </button>
        </div>
      ) : null}
      <section className="smart-results" aria-labelledby="smart-explore">
        <div className="smart-results-heading">
          <h2 id="smart-explore">Explore Jobs <span>{results.length}</span></h2>
          <small>Live listings · not evaluated against a resume</small>
        </div>
        {!loading && !error && !results.length ? (
          <div className="smart-empty" role="status">
            <h3>No jobs in this view.</h3>
            <p>Try All India or a wider posting window, then choose Browse Indian jobs.</p>
          </div>
        ) : null}
        <div className="smart-job-list">
          {results.slice(0, visible).map((job) => <JobCard key={job.id} job={job} />)}
        </div>
        {results.length > visible ? (
          <button className="button button-secondary smart-load-more" onClick={() => setVisible(visible + 8)}>
            Show more jobs
          </button>
        ) : null}
      </section>
      {!loading ? <p className="smart-source-note">
        {jobs.length} source listings loaded · {results.length} in this view. Filters use supplied location, type and posting data.
        Freshers / junior mode hides explicit senior titles; confirm all eligibility requirements on the source.
      </p> : null}
    </main>
      <footer className="jobs-footer">
        <p>Resume Mate</p>
        <p>Live Indian technology jobs · Dev Global Jobs</p>
      </footer>
    </div>
  );
}

function JobCard({ job }) {
  const [details, setDetails] = useState(false);
  return (
    <article
      className={`smart-job ${details ? "score-open" : ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDetails(false);
      }}
      tabIndex={0}
      aria-label={`${job.title} at ${job.company}`}
      onClick={(event) => {
        if (!event.target.closest("a,button,details")) setDetails(!details);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setDetails(false);
        if (event.target === event.currentTarget && ["Enter", " "].includes(event.key)) {
          event.preventDefault();
          setDetails(!details);
        }
      }}
    >
      <div className="smart-job-row">
        <div className="smart-company-mark" aria-hidden="true">
          {job.company === "Company not provided" ? "?" : job.company.split(/\s+/).slice(0, 2).map((word) => word[0]).join("")}
        </div>
        <div className="smart-job-copy">
          <h3>{job.title}</h3>
          <p>{job.company}</p>
          <div className="smart-job-meta">
            <span>{job.location}{job.remote && !/remote/i.test(job.location) ? " · Remote" : ""}</span>
            <span>{job.type}</span>
            {job.salary ? <span>{job.salary}</span> : null}
            <time dateTime={job.postedAt || undefined}>
              {job.postedAt ? new Date(job.postedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Date unavailable"}
            </time>
          </div>
        </div>
        <div className="smart-score-slot"><span className="smart-no-score">Not evaluated</span></div>
        {job.url ? <a className="smart-apply" href={job.url} target="_blank" rel="noopener noreferrer"
          aria-label={`Apply on Source: ${job.title} at ${job.company} (opens in a new tab)`}>Apply ↗</a>
          : <span className="smart-no-score">Application link unavailable</span>}
      </div>
      <details className="smart-score-details" open={details} onToggle={(event) => setDetails(event.currentTarget.open)}>
        <summary>View job details</summary>
        <p>{job.description || "The source did not supply a description. Review the listing on the source for full requirements."}</p>
        {job.closingDate ? <p>Closing date: {new Date(job.closingDate).toLocaleDateString("en-IN")}</p> : null}
        <p>Source: Dev Global Jobs. Confirm requirements and availability before applying.</p>
      </details>
    </article>
  );
}
