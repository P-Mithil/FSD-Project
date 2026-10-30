import test from "node:test";
import assert from "node:assert/strict";
import { normalizeJobs, createSource } from "../backend/jobSources.js";

const now = Date.parse("2026-10-30T12:00:00Z");
const listing = (changes = {}) => ({
  id: 123, title: "React Developer", organization: "Test Company",
  location: "Bengaluru, India", jobType: "Full-time", country: "IN",
  url: "https://devglobaljobs.com/jobs/detail/123", ...changes,
});
const feed = (jobs) => Response.json({ meta: { hasMore: false }, jobs });

test("backend requests the India technology feed and preserves fields and source URLs", async () => {
  const calls = [];
  const source = createSource({ now: () => now, fetchJobs: async (url, options) => {
    calls.push({ url, options });
    return feed([listing()]);
  } });
  const { jobs } = await source.search();
  const query = new URL(calls[0].url).searchParams;
  assert.equal(query.get("country"), "IN");
  assert.equal(query.get("category"), "technology");
  assert.equal(query.get("limit"), "100");
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  assert.equal(jobs[0].company, "Test Company");
  assert.equal(jobs[0].jobType, "Full-time");
  assert.equal(jobs[0].url, listing().url);
  assert.equal(jobs[0].salary, null);
});

test("empty feeds stay empty and missing descriptions never become invented evidence", async () => {
  const source = createSource({ fetchJobs: async () => feed([]) });
  assert.deepEqual((await source.search()).jobs, []);
  const [job] = normalizeJobs([listing()], now);
  assert.equal(job.description, "");
  assert.equal(job.fullDescription, false);
});

test("source details and dates remain plain text", () => {
  const [job] = normalizeJobs([listing({ postedAt: "2026-10-20", location: "Remote, India",
    descriptionExcerpt: "<p>React &amp; CSS</p><script>bad()</script>" })], now);
  assert.equal(job.postedAt, "2026-10-20T00:00:00.000Z");
  assert.equal(job.description, "React & CSS");
  assert.equal(job.remote, true);
});

test("overseas-only and ambiguous remote rows are not represented as India eligible", () => {
  const jobs = normalizeJobs([listing({ location: "United States" }),
    listing({ id: 124, location: "Remote" }), listing({ id: 125, location: "Remote, India" })], now);
  assert.deepEqual(jobs.map((job) => job.id), ["125"]);
});

test("salary text is preserved without inventing currency or missing salaries", () => {
  const jobs = normalizeJobs([listing({ salary: "INR 600,000–900,000 per year" }),
    listing({ id: 124, salary: null }), listing({ id: 125, salary: " " }),
    listing({ id: 126, salary: 900000 })], now);
  assert.deepEqual(jobs.map((job) => job.salary), ["INR 600,000–900,000 per year", null, null, null]);
});

test("missing fields use the original fallbacks and unsafe application URLs are rejected", () => {
  const jobs = normalizeJobs([listing({ organization: null, jobType: null }),
    listing({ id: 124, url: "javascript:alert(1)" }),
    listing({ id: 125, url: "https://evil.test/jobs/detail/125" }), listing({ id: 126, url: null })], now);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, "Company not supplied");
  assert.equal(jobs[0].jobType, "Not specified");
});

test("duplicates, invalid, expired, foreign and future-dated rows are excluded", () => {
  const jobs = normalizeJobs([listing(), listing(), null, listing({ id: "bad" }),
    listing({ id: 124, title: "" }), listing({ id: 125, country: "US" }),
    listing({ id: 126, closingDate: "2000-01-01" }), listing({ id: 127, postedAt: "2026-11-05" })], now);
  assert.equal(jobs.length, 1);
});

test("provider failures return safe errors with no automatic retries", async () => {
  for (const status of [429, 500]) {
    let calls = 0;
    const source = createSource({ fetchJobs: async () => {
      calls++;
      return Response.json({ error: "Internal provider detail" }, { status });
    } });
    await assert.rejects(source.search(), (error) => error.status === (status === 429 ? 429 : 502)
      && !error.message.includes("Internal provider detail"));
    assert.equal(calls, 1);
  }
});

test("invalid JSON and unsupported payloads are errors rather than empty feeds", async () => {
  for (const body of ["bad JSON", "{}", '{"jobs":null}']) {
    const source = createSource({ fetchJobs: async () => new Response(body) });
    await assert.rejects(source.search(), (error) => error.status === 502);
  }
});

test("network errors are safe and are not retried automatically", async () => {
  let calls = 0;
  const source = createSource({ fetchJobs: async () => { calls++; throw new TypeError("Network unavailable"); } });
  await assert.rejects(source.search(), (error) => error.status === 502 && /Could not reach/.test(error.message));
  assert.equal(calls, 1);
});
