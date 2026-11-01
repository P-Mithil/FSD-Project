import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../backend/server.js";
const now = Date.parse("2026-11-05T00:00:00Z");
const resume =
  "Frontend Developer\nFresher\nSkills: React.js, JavaScript, CSS, HTML\nEducation\nB.Tech\nProjects\nBuilt a responsive application.";
const description =
  "Required qualifications\nReact, JavaScript and CSS required.\nNo experience required.\nBachelor's degree required.\n" +
  "Build accessible, responsive pages and reusable components with the engineering team. ".repeat(
    3,
  );
const listing = (id, changes = {}) => ({
  id,
  title: "Frontend Developer",
  organization: "Controlled fixture",
  location: "Bangalore, India",
  country: "IN",
  category: "technology",
  jobType: "Full-time",
  postedAt: "2026-11-04",
  url: `https://devglobaljobs.com/jobs/detail/${id}`,
  descriptionExcerpt: "React and JavaScript",
  ...changes,
});
const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers });
async function withServer(options, run) {
  const server = createApp({ now: () => now, ...options }).listen(
    0,
    "127.0.0.1",
  );
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body) =>
    fetch(base + "/api/jobs/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    await run(base, post);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
test("automatic matching ranks verified jobs, preserves attribution and reuses profiles/results", async () => {
  let calls = 0;
  await withServer(
    {
      fetchJobs: async (url) => {
        calls++;
        return url.includes("?")
          ? json({ meta: { hasMore: false }, jobs: [listing(1), listing(2)] })
          : json(
              listing(url.endsWith("/1") ? 1 : 2, {
                description: url.endsWith("/1")
                  ? description
                  : description.replace(
                      "React, JavaScript and CSS",
                      "React, JavaScript and Python",
                    ),
              }),
            );
      },
    },
    async (_base, post) => {
      const reply = await post({
        resumeText: resume,
        filters: { city: "Bengaluru" },
      });
      assert.equal(reply.status, 200);
      const data = await reply.json();
      assert.equal(data.results.length, 2);
      assert.ok(
        data.results[0].analysis.matchScore >
          data.results[1].analysis.matchScore,
      );
      assert.equal(data.attribution.text, "Powered by Dev Global Jobs");
      assert.equal(calls, 3);
      assert.equal(
        (
          await (
            await post({ resumeText: resume, filters: { city: "Bengaluru" } })
          ).json()
        ).cached,
        true,
      );
      assert.equal(calls, 3);
      await post({
        resumeText: resume + "\nPython",
        filters: { city: "Bengaluru" },
      });
      assert.equal(calls, 3);
    },
  );
});
test("missing resume, bad filters and empty skills do not fetch or invent scores", async () => {
  let calls = 0;
  await withServer(
    {
      fetchJobs: async () => {
        calls++;
        throw Error("must not fetch");
      },
    },
    async (_base, post) => {
      assert.equal((await post({})).status, 400);
      assert.equal(
        (await post({ resumeText: resume, filters: { source: "other" } }))
          .status,
        400,
      );
      const data = await (
        await post({ resumeText: "Accountant with bookkeeping experience" })
      ).json();
      assert.deepEqual(data.results, []);
      assert.match(data.warning, /No identifiable/);
      assert.equal(calls, 0);
    },
  );
});
test("partial 429 preserves completed scores and blocks new calls while cached reads work", async () => {
  let calls = 0;
  await withServer(
    {
      fetchJobs: async (url) => {
        calls++;
        assert.equal(new URL(url).hostname, "devglobaljobs.com");
        if (url.includes("?"))
          return json({
            meta: { hasMore: false },
            jobs: [listing(1), listing(2), listing(3)],
          });
        if (url.endsWith("/1")) return json(listing(1, { description }));
        return json({}, 429, { "Retry-After": "40" });
      },
    },
    async (_base, post) => {
      const first = await (await post({ resumeText: resume })).json();
      assert.equal(first.results.length, 1);
      assert.equal(first.explore.length, 2);
      assert.equal(first.retryAfterSeconds, 40);
      const second = await (await post({ resumeText: resume })).json();
      assert.equal(second.results.length, 1);
      assert.equal(calls, 3);
      assert.ok(!JSON.stringify(first.explore).includes('"matchScore":0'));
    },
  );
});
test("browse without resume, closed detail links and safe provider errors", async () => {
  await withServer(
    {
      fetchJobs: async (url) =>
        url.includes("?")
          ? json({ meta: { hasMore: false }, jobs: [listing(1)] })
          : json({}, 410),
    },
    async (base, post) => {
      assert.equal(
        (await (await fetch(base + "/api/jobs")).json()).jobs.length,
        1,
      );
      const matched = await (await post({ resumeText: resume })).json();
      assert.equal(matched.results.length, 0);
      assert.equal(matched.excluded, 1);
    },
  );
  await withServer(
    { fetchJobs: async () => json({}, 503) },
    async (_base, post) => {
      const reply = await post({ resumeText: resume });
      assert.equal(reply.status, 502);
      assert.match((await reply.json()).error, /temporarily unavailable/);
    },
  );
});

test("Express rejects malformed, oversized and invalid requests without calling the provider", async () => {
  let calls = 0;
  await withServer({ fetchJobs: async () => { calls++; throw Error("must not fetch"); } }, async (base, post) => {
    assert.equal((await post(null)).status, 400);
    assert.equal((await post({ resumeText: "x".repeat(15001) })).status, 400);
    assert.equal((await post({ resumeText: resume, filters: [] })).status, 400);
    assert.equal((await fetch(base + "/api/jobs/match", { method: "POST", body: "text" })).status, 415);
    assert.equal((await fetch(base + "/api/jobs/match", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" })).status, 400);
    assert.equal((await post({ resumeText: "x".repeat(140000) })).status, 413);
    assert.equal((await fetch(base + "/api/jobs?city=%3Cscript%3E")).status, 400);
    assert.equal((await fetch(base + "/api/analyze")).status, 404);
    assert.equal(calls, 0);
  });
});

test("truncated descriptions produce labeled estimates from explicit available requirements", async () => {
  const partial = "Required qualifications\nReact, JavaScript and Python required. " + "Build responsive applications with the team. ".repeat(5) + "…";
  await withServer({ fetchJobs: async (url) => url.includes("?")
    ? json({ meta: { hasMore: false }, jobs: [listing(1)] })
    : json(listing(1, { description: partial })) }, async (_base, post) => {
      const reply = await post({ resumeText: resume });
      assert.equal(reply.status, 200);
      const data = await reply.json();
      assert.equal(data.results.length, 1);
      assert.equal(data.explore.length, 0);
      const item = data.results[0];
      assert.ok(Number.isFinite(item.analysis.matchScore));
      assert.equal(item.analysis.partial, true);
      assert.ok(item.analysis.matchedSkills.includes("React"));
      assert.ok(item.analysis.missingSkills.includes("Python"));
      assert.match(item.analysis.explanation, /incomplete source description/);
      assert.ok(item.job.description.includes("React"));
    });
});


test("failed full-description fetches retain an explicit partial estimate and failure explanation", async () => {
  await withServer({ fetchJobs: async (url) => url.includes("?")
    ? json({ meta: { hasMore: false }, jobs: [listing(1, { description })] })
    : json({}, 503) }, async (_base, post) => {
      const data = await (await post({ resumeText: resume })).json();
      assert.equal(data.results.length, 1);
      assert.equal(data.results[0].analysis.partial, true);
      assert.ok(Number.isFinite(data.results[0].analysis.matchScore));
      assert.match(data.results[0].analysis.explanation, /could not be fetched/);
      assert.match(data.results[0].analysis.explanation, /incomplete source description/);
      assert.ok(!data.results[0].analysis.explanation.includes("no score assigned"));
      assert.ok(data.warning);
    });
});

test("batch-limited descriptions cannot appear as fully verified matches", async () => {
  let details = 0;
  const rows = Array.from({ length: 21 }, (_, idx) => listing(idx + 1, { description }));
  await withServer({ fetchJobs: async (url) => {
    if (url.includes("?")) return json({ meta: { hasMore: false }, jobs: rows });
    details++;
    return json(rows.find(row => String(row.id) === url.split("/").at(-1)));
  } }, async (_base, post) => {
    const data = await (await post({ resumeText: resume })).json();
    assert.equal(details, 20);
    assert.equal(data.results.length, 21);
    const verified = data.results.filter(item => !item.analysis.partial);
    const partial = data.results.filter(item => item.analysis.partial);
    assert.equal(verified.length, 20);
    assert.equal(partial.length, 1);
    assert.match(partial[0].analysis.explanation, /not evaluated in this batch/);
  });
});
