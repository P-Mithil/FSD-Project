import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createApp } from "../backend/server.js";
import { isAnalysisResult } from "../src/reviewAnalysis.js";

const sample = JSON.parse(await readFile(new URL("../src/sampleAnalysis.json", import.meta.url), "utf8"));
const input = { resumeText: sample.resumeText, jobDescription: sample.jobDescription };
const criteria = Object.fromEntries(["required", "preferred", "projects", "experience"].map(category => [
  category, sample.analysis.criteria.filter(item => item.category === category),
]));
const facts = { criteria, annotations: sample.analysis.annotations };
const success = () => new Response(JSON.stringify({ choices: [{
  finish_reason: "stop", message: { content: JSON.stringify(facts) },
}] }), { status: 200 });

test("Express analysis route validates inputs and handles Groq responses safely", async t => {
  const networkFetch = globalThis.fetch;
  const key = process.env.GROQ_API_KEY;
  async function check(provider, run, apiKey = "test-placeholder") {
    if (apiKey === null) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = apiKey;
    let calls = 0;
    globalThis.fetch = async (...args) => { calls++; return provider(...args); };
    const server = createApp().listen(0, "127.0.0.1");
    await once(server, "listening");
    const url = `http://127.0.0.1:${server.address().port}/api/analyze`;
    const post = (body = input, type = "application/json") => networkFetch(url, {
      method: "POST", headers: { "Content-Type": type },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
    try { await run(post, () => calls, url); }
    finally { await new Promise(resolve => server.close(resolve)); }
  }
  try {
    await t.test("missing key returns a safe error without contacting Groq", () => check(success, async (post, calls) => {
      const res = await post();
      assert.equal(res.status, 500);
      assert.match((await res.json()).error, /GROQ_API_KEY/);
      assert.equal(calls(), 0);
    }, null));

    await t.test("invalid input, method, type, JSON and oversized bodies are rejected", () => check(success, async (post, calls, url) => {
      assert.equal((await networkFetch(url)).status, 405);
      assert.equal((await post("{broken")).status, 400);
      assert.equal((await post("PDF", "application/pdf")).status, 415);
      assert.equal((await post({})).status, 400);
      assert.equal((await post({ resumeText: "same text", jobDescription: "same\ntext" })).status, 400);
      assert.equal((await post({ ...input, resumeText: "x".repeat(15001) })).status, 400);
      assert.equal((await post({ resumeText: "x".repeat(140000) })).status, 413);
      assert.equal(calls(), 0);
    }));

    await t.test("success uses Groq only and returns verified results without the key", () => check((url, options) => {
      assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
      assert.equal(options.headers.Authorization, "Bearer test-placeholder");
      const body = JSON.parse(options.body);
      assert.equal(body.response_format.type, "json_schema");
      assert.equal(JSON.parse(body.messages[1].content).RESUME, input.resumeText);
      return success();
    }, async (post, calls) => {
      const res = await post();
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(isAnalysisResult(data, input.resumeText, input.jobDescription));
      assert.equal(data.matchScore, sample.analysis.matchScore);
      assert.equal(calls(), 1);
      assert.ok(!JSON.stringify(data).includes("test-placeholder"));
    }));

    await t.test("rate limits preserve Retry-After and block repeated requests during cooldown", () => check(
      () => new Response("{}", { status: 429, headers: { "Retry-After": "30" } }),
      async (post, calls) => {
        const first = await post();
        assert.equal(first.status, 429);
        assert.equal(first.headers.get("retry-after"), "30");
        const second = await post();
        assert.equal(second.status, 429);
        assert.ok(Number(second.headers.get("retry-after")) > 0);
        assert.equal(calls(), 1);
      },
    ));

    for (const status of [401, 500]) {
      await t.test(`Groq HTTP ${status} becomes a safe error without retrying`, () => check(
        () => new Response('{"error":{"message":"private provider details"}}', { status }),
        async (post, calls) => {
          const res = await post();
          assert.equal(res.status, 502);
          assert.ok(!(await res.text()).includes("private provider details"));
          assert.equal(calls(), 1);
        },
      ));
    }

    await t.test("malformed model JSON has only one correction attempt", () => check(
      () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "not JSON" } }] })),
      async (post, calls) => {
        assert.equal((await post()).status, 502);
        assert.equal(calls(), 2);
      },
    ));
    await t.test("schema-invalid output cannot be displayed as a result", () => check(
      () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "{}" } }] })),
      async (post, calls) => {
        assert.equal((await post()).status, 502);
        assert.equal(calls(), 2);
      },
    ));
    await t.test("network failures and timeouts produce safe errors", async () => {
      for (const name of ["TypeError", "TimeoutError"]) {
        await check(() => { throw Object.assign(new Error("private failure"), { name }); }, async (post, calls) => {
          const res = await post();
          assert.equal(res.status, name === "TimeoutError" ? 504 : 502);
          assert.ok(!(await res.text()).includes("private failure"));
          assert.equal(calls(), 1);
        });
      }
    });
    await t.test("certificate date failures give an actionable error without bypassing TLS", () => check(
      () => { throw new TypeError("fetch failed", { cause: { code: "CERT_NOT_YET_VALID" } }); },
      async (post, calls) => {
        const res = await post();
        assert.equal(res.status, 502);
        assert.match((await res.json()).error, /date and time/);
        assert.equal(calls(), 1);
      },
    ));
  } finally {
    globalThis.fetch = networkFetch;
    if (key === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = key;
  }
});
