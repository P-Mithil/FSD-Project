import test from "node:test";
import assert from "node:assert/strict";
import { filterJobs } from "../backend/jobSources.js";

const now = Date.parse("2026-10-21T12:00:00Z");
const defaults = { city: "", type: "any", days: "any", level: "all" };
const job = (changes = {}) => ({ title: "Junior React Developer", jobType: "Full-time", location: "Bangalore, India", remote: false, postedAt: "2026-10-20", closingDate: null, ...changes });
const filter = (jobs, changes) => filterJobs(jobs, { ...defaults, ...changes, days: changes.days === "any" ? 0 : Number(changes.days ?? 0) }, now);

test("city aliases support Bengaluru, Delhi NCR and other supplied Indian locations", () => {
  assert.equal(filter([job()], { city: "Bengaluru" }).length, 1);
  assert.equal(filter([job({ location: "Gurugram, India" })], { city: "Delhi" }).length, 1);
  assert.equal(filter([job({ location: "Chennai, India" })], { city: "Pune" }).length, 0);
  assert.equal(filter([job({ location: "Ahmedabad, India" })], { city: "Ahmedabad" }).length, 1);
});

test("India remote and employment filters use the listing evidence", () => {
  const jobs = [job(), job({ title: "Developer Intern", jobType: "Internship", location: "Remote, India", remote: true })];
  assert.equal(filter(jobs, { city: "remote" }).length, 1);
  assert.equal(filter(jobs, { type: "remote" }).length, 1);
  assert.equal(filter(jobs, { type: "internship" })[0].title, "Developer Intern");
  assert.equal(filter(jobs, { type: "full-time" })[0].title, "Junior React Developer");
});

test("posting windows exclude old or undated rows unless any date is selected", () => {
  const jobs = [job(), job({ postedAt: "2026-09-30" }), job({ postedAt: null })];
  assert.equal(filter(jobs, { days: "7" }).length, 1);
  assert.equal(filter(jobs, { days: "30" }).length, 2);
  assert.equal(filter(jobs, { days: "any" }).length, 3);
  assert.equal(filter(jobs, { days: "1" }).length, 0);
});

test("fresher mode excludes explicit senior titles and every view excludes closed jobs", () => {
  const jobs = [job(), job({ title: "Senior React Developer" }), job({ title: "Engineering Manager" }), job({ closingDate: "2026-10-20" })];
  assert.equal(filter(jobs, { level: "fresher" }).length, 1);
  assert.equal(filter(jobs, {}).length, 3);
});

test("filters compose without modifying the source feed and can return an empty view", () => {
  const jobs = [job(), job({ location: "Chennai", jobType: "Internship" })];
  const snapshot = structuredClone(jobs);
  assert.equal(filter(jobs, { city: "Chennai", type: "internship" }).length, 1);
  assert.deepEqual(filter(jobs, { city: "Mumbai" }), []);
  assert.deepEqual(jobs, snapshot);
});


test("date filtering uses the current clock and rejects future postings even with no date window", () => {
  const time = Date.now();
  const rows = [job({ title: "Current", postedAt: new Date(time - 86400000).toISOString() }),
    job({ title: "Future", postedAt: new Date(time + 86400000).toISOString() })];
  assert.deepEqual(filterJobs(rows, { days: 0 }).map(row => row.title), ["Current"]);
  assert.deepEqual(filterJobs(rows, { days: 7 }).map(row => row.title), ["Current"]);
});

test("posting-window boundaries keep clock-skew tolerance but reject invalid dated rows", () => {
  const minute = 60000;
  const rows = [job({ title: "Boundary", postedAt: new Date(now - 7 * 86400000).toISOString() }),
    job({ title: "Older", postedAt: new Date(now - 7 * 86400000 - 1).toISOString() }),
    job({ title: "Clock skew", postedAt: new Date(now + 5 * minute).toISOString() }),
    job({ title: "Future", postedAt: new Date(now + 5 * minute + 1).toISOString() }),
    job({ title: "Invalid", postedAt: "not a date" })];
  assert.deepEqual(filterJobs(rows, { days: 7 }, now).map(row => row.title), ["Boundary", "Clock skew"]);
  assert.deepEqual(filterJobs(rows, { days: 0 }, now).map(row => row.title), ["Boundary", "Older", "Clock skew", "Invalid"]);
});
