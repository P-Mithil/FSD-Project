import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAnalysisResult } from "../src/reviewAnalysis.js";
import { buildMatchResult, calculateScore } from "../src/matching.js";

const sample = JSON.parse(await readFile(new URL("../src/sampleAnalysis.json", import.meta.url), "utf8"));
const valid = data => isAnalysisResult(data, sample.resumeText, sample.jobDescription);

test("original verified sample satisfies the complete response contract", () => {
  assert.ok(valid(sample.analysis));
});

test("malformed display fields are rejected without throwing", () => {
  const changes = [
    data => { data.breakdown[0] = null; },
    data => { data.breakdown[0].label = {}; },
    data => { data.breakdown[0].weight = Infinity; },
    data => { data.breakdown[0].earned = -1; },
    data => { data.breakdown[0].possible = 999; },
    data => { data.matchingSkills[0].jdEvidence = {}; },
    data => { data.matchingSkills[0].evidence = "Invented accomplishment"; },
    data => { data.criteria[0].alternatives = null; },
    data => { data.topChanges[0].requirementIds = ["unknown"]; },
  ];
  for (const change of changes) {
    const data = structuredClone(sample.analysis);
    change(data);
    assert.equal(valid(data), false);
  }
});

test("scores outside the range or inconsistent with the original weights are rejected", () => {
  for (const score of [-1, 101, NaN, Infinity, sample.analysis.matchScore + 1]) {
    const data = structuredClone(sample.analysis);
    data.matchScore = score;
    assert.equal(valid(data), false);
  }
});

test("feedback and criteria must quote the actual shared resume and JD", () => {
  const annotation = structuredClone(sample.analysis);
  annotation.annotations[0].quote = "Invented work at another company";
  assert.equal(valid(annotation), false);
  assert.equal(isAnalysisResult(sample.analysis, "A different resume", sample.jobDescription), false);
  assert.equal(isAnalysisResult(sample.analysis, sample.resumeText, "A different role"), false);
});

test("a fully missing match is a genuine zero with missing skills and no strengths", () => {
  const criteria = sample.analysis.criteria.map(item => ({ ...item, status: "missing", resumeEvidence: "" }));
  const data = { ...buildMatchResult(criteria), annotations: [] };
  assert.equal(data.matchScore, 0);
  assert.equal(data.matchingSkills.length, 0);
  assert.equal(data.partialSkills.length, 0);
  assert.ok(data.missingSkills.length > 0);
  assert.ok(valid(data));
});

test("no applicable criteria are rejected instead of returning NaN", () => {
  assert.throws(() => calculateScore([]), /No JD-supported criteria/);
});
