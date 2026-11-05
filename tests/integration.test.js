import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import { createApp } from "../backend/server.js";
import { isAnalysisResult } from "../src/reviewAnalysis.js";

test("one Express app serves analysis, live job browsing and resume matching", async () => {
  const sample = JSON.parse(await readFile(new URL("../src/sampleAnalysis.json", import.meta.url), "utf8"));
  const networkFetch = globalThis.fetch;
  const key = process.env.GROQ_API_KEY;
  const criteria = Object.fromEntries(["required", "preferred", "projects", "experience"].map(category => [
    category, sample.analysis.criteria.filter(item => item.category === category),
  ]));
  let aiCalls = 0;
  let jobCalls = 0;
  process.env.GROQ_API_KEY = "integration-placeholder";
  globalThis.fetch = async url => {
    assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
    aiCalls++;
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ criteria, annotations: sample.analysis.annotations }) } }] });
  };
  const listing = {
    id: 123, title: "Junior Frontend Developer", organization: "Integration fixture",
    country: "IN", location: "Bengaluru, India", category: "technology", jobType: "Full-time",
    postedAt: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    url: "https://devglobaljobs.com/jobs/detail/123", descriptionExcerpt: "React and JavaScript required.",
  };
  const server = createApp({ fetchJobs: async url => {
    jobCalls++;
    return Response.json(url.includes("?")
      ? { meta: { hasMore: false }, jobs: [listing] }
      : { ...listing, description: "Required: React, JavaScript, CSS and Python. " + "Build responsive web interfaces and collaborate with the engineering team. ".repeat(5) });
  } }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) => networkFetch(base + path, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  try {
    const analysis = await post("/api/analyze", { resumeText: sample.resumeText, jobDescription: sample.jobDescription });
    assert.equal(analysis.status, 200);
    assert.ok(isAnalysisResult(await analysis.json(), sample.resumeText, sample.jobDescription));
    const jobs = await networkFetch(base + "/api/jobs");
    assert.equal(jobs.status, 200);
    assert.equal((await jobs.json()).jobs.length, 1);
    const match = await post("/api/jobs/match", { resumeText: sample.resumeText });
    assert.equal(match.status, 200);
    const data = await match.json();
    assert.equal(data.results.length, 1);
    assert.ok(Number.isFinite(data.results[0].analysis.matchScore));
    assert.ok(data.results[0].analysis.matchScore >= 0 && data.results[0].analysis.matchScore <= 100);
    assert.ok(data.results[0].analysis.matchedSkills.includes("React"));
    assert.ok(data.results[0].analysis.missingSkills.includes("Python"));
    assert.equal(data.results[0].job.url, listing.url);
    assert.equal(aiCalls, 1);
    const calls = jobCalls;
    const again = await post("/api/jobs/match", { resumeText: sample.resumeText });
    assert.equal(again.status, 200);
    assert.deepEqual((await again.json()).results, data.results);
    assert.equal(jobCalls, calls);
  } finally {
    globalThis.fetch = networkFetch;
    if (key === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = key;
    await new Promise(resolve => server.close(resolve));
  }
});
