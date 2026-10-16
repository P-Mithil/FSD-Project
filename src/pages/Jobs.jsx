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
    <main aria-labelledby="jobs-title">
      <h1 id="jobs-title">Live Jobs</h1>
      <p>Browse technology job listings from the India feed.</p>
      <p>
        <a href="https://devglobaljobs.com" target="_blank" rel="noopener noreferrer">
          Powered by Dev Global Jobs
        </a>
      </p>

      {loading ? <p role="status">Loading jobs...</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!loading && !error && jobs.length === 0 ? (
        <p role="status">No jobs are available from this feed right now.</p>
      ) : null}

      <ul className="jobs-list" aria-label="Job listings">
        {jobs.map((job) => (
          <li key={job.id}>
            <h2>{job.title}</h2>
            <dl>
              <div><dt>Company</dt><dd>{job.company}</dd></div>
              <div><dt>Location</dt><dd>{job.location}</dd></div>
              <div><dt>Employment type</dt><dd>{job.type}</dd></div>
            </dl>
            {job.url ? (
              <a href={job.url} target="_blank" rel="noopener noreferrer">
                Apply on Source<span className="jobs-sr-only">: {job.title} at {job.company}</span>
              </a>
            ) : <p>Application link unavailable.</p>}
          </li>
        ))}
      </ul>
    </main>
  );
}
