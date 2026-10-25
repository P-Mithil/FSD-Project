import test from "node:test";
import assert from "node:assert/strict";
import {
  validateCriteria,
  calculateScore,
  buildMatchResult,
} from "../src/matching.js";

const jd = `Required: React, Node.js, Express, PostgreSQL or MySQL.
Preferred: Docker, TypeScript.
Show a web application project.
Experience building backend APIs.
Demonstrate your work with concrete examples.`;
const strong =
  "Built a React web application using Node.js, Express, and MySQL. Used Docker and TypeScript. Built backend APIs with concrete examples.";
const partial =
  "Built a React web application using Flask and MySQL. Built a Flask backend API for a course project.";
const weak = "Managed retail inventory and assisted customers.";
// Expected extracted facts for three real text fixtures. The model's semantic
// extraction remains separate from testing the deterministic scoring rules.
function facts(resume) {
  const skill = (category, name, alternatives, evidence, related = "") => ({
    category,
    name,
    alternatives,
    status: evidence ? "matched" : related ? "partial" : "missing",
    resumeEvidence: evidence || related,
    jdEvidence:
      category === "required"
        ? "Required: React, Node.js, Express, PostgreSQL or MySQL."
        : "Preferred: Docker, TypeScript.",
    explanation: evidence
      ? `The resume demonstrates ${name}.`
      : related
        ? `Flask is transferable backend experience, not ${name}.`
        : `No evidence of ${name}.`,
  });
  const isStrong = resume === strong;
  const isPartial = resume === partial;
  return [
    skill("required", "React", ["React"], isStrong || isPartial ? resume : ""),
    skill(
      "required",
      "Node.js",
      ["Node.js"],
      isStrong ? resume : "",
      isPartial ? resume : "",
    ),
    skill(
      "required",
      "Express",
      ["Express"],
      isStrong ? resume : "",
      isPartial ? resume : "",
    ),
    skill(
      "required",
      "SQL database",
      ["PostgreSQL", "MySQL"],
      isStrong || isPartial ? resume : "",
    ),
    skill("preferred", "Docker", ["Docker"], isStrong ? resume : ""),
    skill("preferred", "TypeScript", ["TypeScript"], isStrong ? resume : ""),
    ...[
      ["projects", "Web project", "Show a web application project."],
      ["experience", "Backend APIs", "Experience building backend APIs."],
      [
        "evidence",
        "Concrete examples",
        "Demonstrate your work with concrete examples.",
      ],
    ].map(([category, name, jdEvidence]) => ({
      category,
      name,
      jdEvidence,
      alternatives: [],
      status: isStrong ? "matched" : isPartial ? "partial" : "missing",
      resumeEvidence: isStrong || isPartial ? resume : "",
      explanation: `Evidence for ${name}.`,
    })),
  ];
}
const result = (resume) =>
  buildMatchResult(validateCriteria(facts(resume), resume, jd));

test("A: strong match scores highly with all JD-supported categories", () => {
  const analysis = result(strong);
  assert.ok(analysis.matchScore >= 90);
  assert.equal(analysis.missingSkills.length, 0);
  assert.ok(analysis.breakdown.every((row) => row.earned === row.possible));
});
test("B: frontend plus transferable Flask experience is a moderate match", () => {
  const analysis = result(partial);
  assert.ok(analysis.matchScore >= 40 && analysis.matchScore < 80);
  assert.ok(analysis.matchScore < result(strong).matchScore);
  assert.deepEqual(
    analysis.partialSkills.map((item) => item.name),
    ["Node.js", "Express"],
  );
  assert.ok(!analysis.matchingSkills.some((item) => item.name === "Node.js"));
});
test("C: unrelated resume has no supported software-engineering match", () => {
  const analysis = result(weak);
  assert.ok(analysis.matchScore < 25);
  assert.equal(analysis.matchingSkills.length, 0);
  assert.ok(analysis.breakdown.every((row) => row.earned === 0));
});
test("D: MySQL fully satisfies a PostgreSQL OR MySQL requirement once", () => {
  const extracted = facts(partial);
  extracted[3].status = "partial";
  const checked = validateCriteria(extracted, partial, jd);
  assert.equal(checked[3].status, "matched");
  assert.equal(
    checked.filter((item) => item.id === "q:mysql|postgres").length,
    1,
  );
  extracted[3].alternatives.push("SQLite");
  assert.equal(validateCriteria(extracted, partial, jd), null);
});
test("transferable backend work is recognized even when extraction calls it missing", () => {
  const extracted = facts(partial);
  extracted[1].status = "missing";
  extracted[1].resumeEvidence = "";
  const checked = validateCriteria(extracted, partial, jd);
  assert.equal(checked[1].status, "partial");
  assert.match(checked[1].resumeEvidence, /Flask/);
  assert.match(checked[1].explanation, /does not demonstrate Node.js/);
});
test("AND requirements are split into independent criteria rather than accepted as OR", () => {
  const extracted = facts(strong);
  extracted[0].alternatives = ["React", "Node.js"];
  // Use only the grouped criterion to avoid intentionally duplicating Node.js.
  const checked = validateCriteria([extracted[0]], strong, jd);
  assert.deepEqual(
    checked.map((item) => item.name),
    ["React", "Node.js"],
  );
  assert.ok(checked.every((item) => item.alternatives.length === 1));
});
test("E: losing a preferred skill costs less than losing a mandatory skill", () => {
  const complete = validateCriteria(facts(strong), strong, jd);
  const lose = (name) =>
    complete.map((item) =>
      item.name === name
        ? { ...item, status: "missing", resumeEvidence: "" }
        : item,
    );
  const base = calculateScore(complete).matchScore;
  assert.ok(
    base - calculateScore(lose("Docker")).matchScore <
      base - calculateScore(lose("Node.js")).matchScore,
  );
  const analysis = buildMatchResult(
    lose("Docker").map((item) =>
      item.name === "Node.js" ? { ...item, status: "missing" } : item,
    ),
  );
  assert.equal(analysis.topChanges[0].category, "required");
  assert.equal(analysis.topChanges[0].type, "learn_skill");
});
test("F: identical extracted facts give exactly the same score and breakdown", () => {
  const checked = validateCriteria(facts(partial), partial, jd);
  const first = calculateScore(checked);
  for (let attempt = 0; attempt < 10; attempt++)
    assert.deepEqual(calculateScore(structuredClone(checked)), first);
  assert.equal(
    first.matchScore,
    Math.round(first.breakdown.reduce((sum, row) => sum + row.contribution, 0)),
  );
});
test("absent categories redistribute weights; missing requirements stay applicable", () => {
  const checked = validateCriteria(facts(partial), partial, jd).filter(
    (item) => item.category === "required",
  );
  const analysis = calculateScore(checked);
  assert.equal(analysis.breakdown[0].effectiveWeight, 100);
  assert.ok(
    analysis.breakdown
      .slice(1)
      .every(
        (row) =>
          !row.applicable && row.effectiveWeight === 0 && row.score === null,
      ),
  );
  assert.equal(
    calculateScore(checked.map((item) => ({ ...item, status: "missing" })))
      .matchScore,
    0,
  );
});
test("unverifiable resume quotes earn no credit; invented JD criteria are rejected", () => {
  const extracted = facts(strong);
  extracted[0].resumeEvidence = "Invented React achievement";
  assert.equal(validateCriteria([extracted[0]], weak, jd)[0].status, "missing");
  const grounded = validateCriteria([extracted[0]], strong, jd)[0];
  assert.equal(grounded.status, "matched");
  assert.ok(strong.includes(grounded.resumeEvidence));
  assert.notEqual(grounded.resumeEvidence, extracted[0].resumeEvidence);
  extracted[0].jdEvidence = "Invented JD requirement";
  const recovered = validateCriteria(extracted, strong, jd);
  assert.ok(jd.includes(recovered[0].jdEvidence));
  extracted[0].alternatives = ["Kubernetes"];
  assert.equal(validateCriteria(extracted, strong, jd), null);
  const deduplicated = validateCriteria(
    [...facts(strong), facts(strong)[0]],
    strong,
    jd,
  );
  assert.equal(deduplicated.length, facts(strong).length);
  assert.equal(
    calculateScore(deduplicated).matchScore,
    calculateScore(validateCriteria(facts(strong), strong, jd)).matchScore,
  );
});
test("recommendations distinguish new projects and weak existing experience", () => {
  const missingProjects = validateCriteria(facts(weak), weak, jd).filter(
    (item) => item.category === "projects",
  );
  const partialExperience = validateCriteria(
    facts(partial),
    partial,
    jd,
  ).filter((item) => item.category === "experience");
  const recommendations = buildMatchResult([
    ...missingProjects,
    ...partialExperience,
  ]).topChanges;
  assert.ok(recommendations.some((item) => item.type === "build_project"));
  assert.ok(
    recommendations.some((item) => item.type === "describe_experience"),
  );
});
