import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true } });
after(() => server.close());
const { DocumentInput } = await server.ssrLoadModule("/src/components/DocumentInput.jsx");
const { default: Upload } = await server.ssrLoadModule("/src/pages/Upload.jsx");
const { ReviewResults } = await server.ssrLoadModule("/src/components/ReviewResults.jsx");
const { default: sample } = await server.ssrLoadModule("/src/sampleAnalysis.json");

function render(props) {
  return renderToStaticMarkup(createElement(DocumentInput, {
    kind: "resume", title: "Resume", value: "Existing pasted text", limit: 15000,
    onFileChange() {}, onTextChange() {}, ...props,
  }));
}

test("file errors are linked to their own input while preserved text stays valid", () => {
  const resume = render({ error: "This PDF could not be read." });
  assert.match(resume, /id="resume-file"[^>]*aria-invalid="true"[^>]*aria-describedby="resume-error"/);
  assert.match(resume, /id="resume-error"[^>]*role="alert"/);
  assert.match(resume, /id="resume-text"[^>]*aria-invalid="false"/);
  assert.ok(resume.includes("Existing pasted text"));

  const job = render({ kind: "job", title: "Job description", limit: 12000 });
  assert.ok(!job.includes("resume-error"));
  assert.ok(!job.includes('role="alert"'));
});

test("pasted text limits and accessible error IDs stay independent for each document", () => {
  for (const [kind, title, limit] of [["resume", "Resume", 15000], ["job", "Job description", 12000]]) {
    const valid = render({ kind, title, limit, value: "x".repeat(limit) });
    assert.ok(!valid.includes('role="alert"'));
    const invalid = render({ kind, title, limit, value: "x".repeat(limit + 1) });
    assert.ok(invalid.includes(`aria-describedby="${kind}-count ${kind}-limit-error"`));
    assert.ok(invalid.includes(`id="${kind}-limit-error"`));
    assert.ok(invalid.includes(`Use up to ${limit.toLocaleString()} characters for ${title.toLowerCase()}.`));
  }
});

test("upload renders both document texts supplied by its parent for analysis integration", () => {
  const html = renderToStaticMarkup(createElement(Upload, {
    text: { resume: "Shared resume text", job: "Shared job description" },
    onTextChange() {},
  }));
  assert.match(html, /id="resume-text"[^>]*>Shared resume text<\/textarea>/);
  assert.match(html, /id="job-text"[^>]*>Shared job description<\/textarea>/);
  assert.ok(!html.includes('role="alert"'));
});

test("results preserve shared resume text without inventing a live score", () => {
  const html = renderToStaticMarkup(createElement(ReviewResults, {
    analysis: null, resumeText: "My uploaded resume <script>", jobDescription: "React developer",
  }));
  assert.ok(html.includes("My uploaded resume &lt;script&gt;"));
  assert.ok(html.includes("Resume ready"));
  assert.ok(html.includes("Job description ready"));
  assert.ok(html.includes("Match score unavailable"));
  assert.ok(html.includes("No score has been calculated."));
  assert.ok(!html.includes("out of 100"));
  assert.ok(!html.includes('class="resume-highlight"'));
});

test("original fictional sample renders its score, annotations, skills and three improvements", () => {
  const html = renderToStaticMarkup(createElement(ReviewResults, {
    ...sample, isDemo: true,
  }));
  assert.ok(html.includes("Fictional resume and saved results"));
  assert.ok(html.includes(`Estimated match score: ${sample.analysis.matchScore} out of 100`));
  assert.equal((html.match(/class="card change-card"/g) || []).length, 3);
  assert.equal((html.match(/class="resume-highlight"/g) || []).length, 2);
  for (const label of ["Matched Skills", "Partially Matched Skills", "Missing Skills", "How was this score calculated?"]) {
    assert.ok(html.includes(label));
  }
});

test("analysis loading disables both documents and exposes an accessible status", () => {
  const html = renderToStaticMarkup(createElement(Upload, {
    text: { resume: "Resume", job: "Job description" }, onTextChange() {}, onAnalyze() {},
    loading: true, error: "Safe API error",
  }));
  assert.match(html, /id="resume-file"[^>]*disabled/);
  assert.match(html, /id="job-file"[^>]*disabled/);
  assert.ok(html.includes('role="status">Analyzing your documents with Groq'));
  assert.ok(html.includes('role="alert">Safe API error'));
  assert.ok(html.includes('aria-busy="true"'));
});
