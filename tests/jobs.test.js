import test from "node:test";
import assert from "node:assert/strict";
import { getJobs } from "../src/jobs.js";

const listing = (changes = {}) => ({
  id: 123,
  title: "React Developer",
  organization: "Test Company",
  location: "Bengaluru, India",
  jobType: "Full-time",
  country: "IN",
  url: "https://devglobaljobs.com/jobs/detail/123",
  ...changes,
});

function mockFeed(t, jobs) {
  return t.mock.method(globalThis, "fetch", async () =>
    Response.json({ jobs }),
  );
}

test("requests the India technology feed and preserves listing fields and source URLs", async (t) => {
  const mock = mockFeed(t, [listing()]);
  const jobs = await getJobs(new AbortController().signal);
  const [url, options] = mock.mock.calls[0].arguments;
  const query = new URL(url).searchParams;
  assert.equal(query.get("country"), "IN");
  assert.equal(query.get("category"), "technology");
  assert.equal(query.get("limit"), "100");
  assert.ok(options.signal instanceof AbortSignal);
  assert.deepEqual(jobs, [{
    id: "123", title: "React Developer", company: "Test Company",
    location: "Bengaluru, India", remote: false, postedAt: null, closingDate: null,
    description: "", type: "Full-time", salary: null, url: listing().url,
  }]);
});

test("an empty feed stays empty", async (t) => {
  mockFeed(t, []);
  assert.deepEqual(await getJobs(new AbortController().signal), []);
});

test("preserves source details and dates while decoding HTML as plain text", async (t) => {
  mockFeed(t, [listing({ postedAt: "2026-10-20", descriptionExcerpt: "<p>React &amp; CSS</p><script>bad()</script>", location: "Remote, India" })]);
  const [job] = await getJobs(new AbortController().signal);
  assert.equal(job.postedAt, "2026-10-20T00:00:00.000Z");
  assert.equal(job.description, "React & CSS");
  assert.equal(job.remote, true);
});

test("does not present overseas-only or ambiguous remote listings as India eligible", async (t) => {
  mockFeed(t, [listing({ location: "United States" }), listing({ id: 124, location: "Remote" }), listing({ id: 125, location: "Remote, India" })]);
  const jobs = await getJobs(new AbortController().signal);
  assert.deepEqual(jobs.map((job) => job.id), ["125"]);
});

test("preserves supplied salary text and does not invent missing salary details", async (t) => {
  mockFeed(t, [
    listing({ salary: "  INR 600,000–900,000 per year  " }),
    listing({ id: 124, salary: null }),
    listing({ id: 125, salary: " " }),
    listing({ id: 126, salary: 900000 }),
  ]);
  const jobs = await getJobs(new AbortController().signal);
  assert.deepEqual(jobs.map((job) => job.salary), [
    "INR 600,000–900,000 per year", null, null, null,
  ]);
});

test("labels absent fields and never exposes unsafe application URLs", async (t) => {
  mockFeed(t, [
    listing({ organization: null, location: "", jobType: null }),
    listing({ id: 127, url: "javascript:alert(1)" }),
    listing({ id: 124, url: "https://evil.test/jobs/detail/124" }),
    listing({ id: 125, url: null }),
  ]);
  const jobs = await getJobs(new AbortController().signal);
  assert.equal(jobs[0].company, "Company not provided");
  assert.equal(jobs[0].location, "Location not provided");
  assert.equal(jobs[0].type, "Employment type not provided");
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, listing().url);
});

test("omits expired, invalid and foreign rows and deduplicates IDs", async (t) => {
  mockFeed(t, [listing(), listing(), null, listing({ id: "bad" }),
    listing({ id: 124, title: "" }), listing({ id: 125, country: "US" }),
    listing({ id: 126, closingDate: "2000-01-01" })]);
  const jobs = await getJobs(new AbortController().signal);
  assert.equal(jobs.length, 1);
});

test("provider failures use safe messages and never automatically retry", async (t) => {
  for (const status of [429, 500]) {
    const mock = t.mock.method(globalThis, "fetch", async () =>
      Response.json({ error: "Internal provider detail" }, { status }),
    );
    await assert.rejects(getJobs(new AbortController().signal),
      status === 429 ? /service is busy/ : /could not be loaded/);
    assert.equal(mock.mock.callCount(), 1);
    mock.mock.restore();
  }
});

test("malformed JSON and unsupported response shapes are errors, not empty feeds", async (t) => {
  for (const body of ["bad JSON", "{}", '{"jobs":null}']) {
    const mock = t.mock.method(globalThis, "fetch", async () => new Response(body));
    await assert.rejects(getJobs(new AbortController().signal), /unexpected response/);
    mock.mock.restore();
  }
});

test("network errors and cancellation are passed to the page without a retry", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async (_url, options) => {
    options.signal.throwIfAborted();
    throw new TypeError("Network unavailable");
  });
  const request = new AbortController();
  await assert.rejects(getJobs(request.signal), TypeError);
  request.abort();
  await assert.rejects(getJobs(request.signal), { name: "AbortError" });
  assert.equal(mock.mock.callCount(), 2);
});

test("future-dated listings are excluded even when browsing any date", async (t) => {
  mockFeed(t, [listing(), listing({ id: 124, postedAt: new Date(Date.now() + 86400000).toISOString() })]);
  const jobs = await getJobs(new AbortController().signal);
  assert.deepEqual(jobs.map((job) => job.id), ["123"]);
});
