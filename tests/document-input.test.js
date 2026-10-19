import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true } });
after(() => server.close());
const { DocumentInput } = await server.ssrLoadModule("/src/components/DocumentInput.jsx");
const { default: Upload } = await server.ssrLoadModule("/src/pages/Upload.jsx");

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
