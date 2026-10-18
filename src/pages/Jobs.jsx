import { useEffect, useState } from "react";
import { getJobs } from "../jobs.js";
import "./Jobs.css";

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const request = new AbortController();

    async function loadJobs() {
      try {
        const data = await getJobs(request.signal);
        if (!request.signal.aborted) setJobs(data);
      } catch (failure) {
        if (!request.signal.aborted) {
          setError(
            failure.name === "TimeoutError"
              ? "The jobs service took too long to respond. Please try again later."
              : failure instanceof TypeError
                ? "Could not connect to the jobs service. Check your connection and try again later."
                : failure.message,
          );
        }
      } finally {
        if (!request.signal.aborted) setLoading(false);
      }
    }

    loadJobs();
    return () => request.abort();
  }, []);

  return (
    <main className="jobs-page" aria-labelledby="jobs-title">
      <div className="jobs-heading">
        <div>
          <p className="jobs-eyebrow">RESUMATE · OPPORTUNITIES</p>
          <h1 id="jobs-title">Live Jobs</h1>
          <p>Browse technology job listings from the India feed.</p>
        </div>
        <a className="jobs-attribution" href="https://devglobaljobs.com" target="_blank" rel="noopener noreferrer">
          Powered by Dev Global Jobs
        </a>
      </div>

      {loading ? <p role="status">Loading jobs...</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!loading && !error && jobs.length === 0 ? (
        <p role="status">No jobs are available from this feed right now.</p>
      ) : null}

      <ul className="jobs-list" aria-label="Job listings">
        {jobs.map((job) => (
          <li key={job.id}>
            <JobCard job={job} />
          </li>
        ))}
      </ul>
    </main>
  );
}

function JobCard({ job }) {
  const initials = job.company === "Company not provided"
    ? "?"
    : job.company.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();

  return (
    <article className="job-card" aria-labelledby={`job-${job.id}-title`}>
      <header className="job-company-row">
        <span className="job-initials" aria-hidden="true">{initials}</span>
        <p className="job-company">{job.company}</p>
      </header>
      <h2 id={`job-${job.id}-title`}>{job.title}</h2>
      <dl className="job-details">
        <div>
          <dt>Location</dt>
          <dd>{job.location}</dd>
        </div>
        <div>
          <dt>Employment type</dt>
          <dd>{job.type}</dd>
        </div>
      </dl>
      <footer className="job-footer">
        <div className="job-pay">
          <span>Salary</span>
          <p className={job.salary ? "job-salary" : "job-salary-missing"}>
            {job.salary || "Not listed"}
          </p>
        </div>
        {job.url ? (
          <a
            className="job-apply"
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Apply on Source: ${job.title} at ${job.company} (opens in a new tab)`}
          >
            Apply on Source <span aria-hidden="true">↗</span>
          </a>
        ) : <span className="job-link-missing">Application link unavailable</span>}
      </footer>
    </article>
  );
}
