import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeJobs,
  filterJobs,
  descriptionText,
  safeJobUrl,
  createSource,
} from "../backend/jobSources.js";
const now = Date.parse("2026-11-05T00:00:00Z");
const listing = (changes = {}) => ({
  id: 123,
  title: "Frontend Developer",
  organization: "Controlled test company",
  location: "Bangalore, India",
  country: "IN",
  category: "technology",
  jobType: "Full-time",
  postedAt: "2026-11-04",
  descriptionExcerpt: "React and CSS role",
  url: "https://devglobaljobs.com/jobs/detail/123",
  ...changes,
});
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers });
test("normalization removes duplicates, foreign/expired jobs and invalid or replaced links", () => {
  const rows = normalizeJobs(
    [
      listing(),
      listing(),
      listing({ url: "javascript:alert(1)" }),
      listing({ country: "US" }),
      listing({ closingDate: "2026-11-01" }),
      listing({ location: "United States" }),
      listing({ title: "Tax Manager" }),
    ],
    now,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].url, listing().url);
  assert.equal(rows[0].salary, null);
  assert.equal(rows[0].logo, null);
  assert.equal(rows[0].fullDescription, false);
  for (const url of [
    "https://evil.test/jobs/detail/123",
    "https://user:secret@devglobaljobs.com/jobs/detail/123",
  ])
    assert.equal(safeJobUrl(url), "");
});
test("country IN cannot admit overseas-only remote territories", () => {
  assert.equal(
    normalizeJobs(
      [
        listing({
          location: "Algeria, British Indian Ocean Territory, Zambia",
          category: "remote",
        }),
      ],
      now,
    ).length,
    0,
  );
  assert.equal(
    normalizeJobs(
      [listing({ location: "Remote, India", category: "remote" })],
      now,
    )[0].remote,
    true,
  );
});
test("double-encoded HTML becomes plain text with requirement boundaries", () => {
  assert.equal(
    descriptionText(
      "&lt;h2&gt;Requirements&lt;/h2&gt;&lt;p&gt;React &amp;amp; CSS&lt;/p&gt;<script>bad()</script>",
    ),
    "Requirements\nReact & CSS",
  );
});
test("city aliases, date, remote, job type and fresher filters use supplied evidence", () => {
  for (const [raw, city] of [
    ["Bangalore", "Bengaluru"],
    ["Gurugram", "Delhi"],
    ["Hyderabad", "Hyderabad"],
    ["Pune", "Pune"],
    ["Chennai", "Chennai"],
    ["Mumbai", "Mumbai"],
  ]) {
    const rows = normalizeJobs([listing({ location: raw })], now);
    assert.equal(filterJobs(rows, { city, days: 7 }, now).length, 1);
    assert.equal(filterJobs(rows, { city: "Kolkata", days: 7 }, now).length, 0);
  }
  const undated = normalizeJobs([listing({ postedAt: "bad" })], now);
  assert.equal(filterJobs(undated, { days: 7 }, now).length, 0);
  assert.equal(filterJobs(undated, { days: 0 }, now).length, 1);
  assert.equal(
    filterJobs(
      normalizeJobs([listing({ title: "Senior Frontend Developer" })], now),
      { level: "fresher" },
      now,
    ).length,
    0,
  );
  assert.equal(
    filterJobs(normalizeJobs([listing()], now), { type: "internship" }, now)
      .length,
    0,
  );
  assert.equal(
    filterJobs(
      normalizeJobs([listing({ location: "Bangalore; Hyderabad" })], now),
      { city: "Hyderabad" },
      now,
    ).length,
    1,
  );
  assert.equal(
    filterJobs(
      normalizeJobs([listing({ location: "Vadodara" })], now),
      { city: "Vadodara" },
      now,
    ).length,
    1,
  );
});
test("fetch uses one provider, documented parameters, two bounded pages and cache reuse", async () => {
  const urls = [];
  const api = createSource({
    now: () => now,
    fetchJobs: async (url) => {
      urls.push(url);
      return json({ meta: { hasMore: urls.length === 1 }, jobs: [listing()] });
    },
  });
  assert.equal((await api.search("React")).retrieved, 2);
  assert.equal((await api.search("React")).jobs.length, 1);
  assert.equal(urls.length, 2);
  for (const url of urls) {
    const p = new URL(url);
    assert.equal(p.hostname, "devglobaljobs.com");
    assert.equal(p.searchParams.get("country"), "IN");
    assert.equal(p.searchParams.get("search"), "React");
    assert.equal(p.searchParams.get("limit"), "100");
  }
});
test("429 respects retry-after, blocks calls during cooldown and never retries automatically", async () => {
  let time = now;
  let calls = 0;
  const api = createSource({
    now: () => time,
    fetchJobs: async () => {
      calls++;
      return json({}, 429, { "Retry-After": "30" });
    },
  });
  await assert.rejects(
    api.search(),
    (e) => e.status === 429 && e.retryAfterSeconds === 30,
  );
  time += 10000;
  await assert.rejects(
    api.search("React"),
    (e) => e.status === 429 && e.retryAfterSeconds === 20,
  );
  assert.equal(calls, 1);
});
test("provider failures and malformed payloads yield safe errors, never invented listings", async () => {
  for (const reply of [
    json({}, 500),
    new Response("not json"),
    json({ jobs: [], meta: {} }),
  ])
    await assert.rejects(
      createSource({ fetchJobs: async () => reply }).search(),
      (e) => e.status === 502,
    );
});

const feed = (jobs) => json({ meta: { hasMore: false }, jobs });

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
  assert.equal(jobs[0].company, listing().organization);
  assert.equal(jobs[0].jobType, "Full-time");
  assert.equal(jobs[0].url, listing().url);
  assert.equal(jobs[0].salary, null);
});

test("empty feeds stay empty and missing descriptions never become invented evidence", async () => {
  const source = createSource({ fetchJobs: async () => feed([]) });
  assert.deepEqual((await source.search()).jobs, []);
  const [job] = normalizeJobs([listing({ descriptionExcerpt: null })], now);
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
    listing({ id: 126, closingDate: "2000-01-01" }), listing({ id: 127, postedAt: new Date(now + 86400000).toISOString() })], now);
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
