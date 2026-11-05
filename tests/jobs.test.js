import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../backend/server.js";
import { getProfile, getScore } from "../backend/score.js";
import { normalizeJobs, filterJobs, safeJobUrl } from "../backend/jobSources.js";

test("jobs preserve source links, reject invalid listings and return stable ranked scores", async () => {
  const now = Date.now();
  const resume = "Frontend Developer\nFresher\nSkills: React, JavaScript, CSS\nEducation\nB.Tech\nProjects\nBuilt a responsive React application.";
  const description = "Required: React, JavaScript and CSS. No experience required. Bachelor's degree required. " + "Build responsive user interfaces with the engineering team. ".repeat(4);
  const listing = id => ({
    id, title: "Frontend Developer", organization: "Test company", country: "IN", location: "Bengaluru, India", jobType: "Full-time",
    postedAt: new Date(now - 86400000).toISOString(), url: `https://devglobaljobs.com/jobs/detail/${id}`, descriptionExcerpt: "React and JavaScript required.",
  });
  const rows = normalizeJobs([listing(1), { ...listing(2), postedAt: new Date(now + 86400000).toISOString() }, { ...listing(3), country: "US" }], now);
  assert.equal(rows.length, 1);
  assert.equal(safeJobUrl("javascript:alert(1)"), "");
  assert.equal(filterJobs(rows, { city: "Bangalore", days: 7, type: "full-time" }, now).length, 1);
  assert.equal(filterJobs(rows, { city: "Chennai", days: 7, type: "any" }, now).length, 0);
  assert.equal(filterJobs([{ ...rows[0], title: "Senior Frontend Developer" }], { level: "fresher" }, now).length, 0);
  const job = { ...rows[0], description, fullDescription: true };
  const profile = getProfile(resume);
  const score = getScore(job, profile, "Bengaluru");
  assert.equal(score.matchScore, 100);
  assert.deepEqual(getScore(job, profile, "Bengaluru"), score);
  assert.ok(getScore(job, getProfile("Accountant, Excel and bookkeeping")).matchScore < 30);
  assert.equal(getScore({ ...job, description: "" }, profile).matchScore, null);
  assert.ok(getScore({ ...job, fullDescription: false }, profile, "", { allowPartial: true }).partial);
  assert.ok(score.breakdown.every(row => Number.isFinite(row.contribution)));
  const unknown = getScore({ title: "Opportunity", description: "Contact the company for further information. ".repeat(6), location: "", fullDescription: true }, profile);
  assert.equal(unknown.matchScore, null);
  assert.ok(unknown.breakdown.every(row => row.effectiveWeight === 0 && row.contribution === 0 && Number.isFinite(row.credit)));
  let calls = 0;
  const server = createApp({ fetchJobs: async url => {
    calls++;
    return Response.json(url.includes("?")
      ? { meta: { hasMore: false }, jobs: [listing(1), listing(2)] }
      : { ...listing(url.endsWith("/1") ? 1 : 2), description: url.endsWith("/1") ? description : description.replace("React, JavaScript and CSS", "React, JavaScript and Python") });
  } }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = body => fetch(base + "/api/jobs/match", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  try {
    assert.equal((await post({})).status, 400);
    assert.equal((await fetch(base + "/api/jobs?days=invalid")).status, 400);
    assert.equal((await fetch(base + "/api/jobs?days=any")).status, 200);
    const res = await post({ resumeText: resume, filters: { days: "any" } });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.results.length, 2);
    assert.ok(data.results[0].analysis.matchScore > data.results[1].analysis.matchScore);
    assert.ok(data.results.every(item => safeJobUrl(item.job.url)));
    const before = calls;
    const cached = await (await post({ resumeText: resume, filters: { days: "any" } })).json();
    assert.deepEqual(cached.results, data.results);
    assert.equal(calls, before);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
