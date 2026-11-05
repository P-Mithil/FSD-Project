import test from "node:test";
import assert from "node:assert/strict";
import {
  getProfile,
  extractSkills,
  getRequirements,
  getScore,
  sortJobs,
} from "../backend/score.js";
const description =
  "Required qualifications\nReact, JavaScript and CSS are required.\n0 years of work experience required.\nBachelor's degree required.\nResponsibilities\nBuild accessible user interfaces and reusable components. Work with designers to deliver responsive pages, review code and maintain clear documentation for each feature.";
const job = {
  id: "1",
  title: "Frontend Developer",
  description,
  fullDescription: true,
  location: "Bengaluru, India",
  remote: false,
  postedAt: "2026-11-04",
};
const resume =
  "Frontend Developer\nFresher\nSkills: React.js, JS, HTML5, CSS3\nEducation\nB.Tech CSE\nProjects\nBuilt a responsive React application using JavaScript and CSS.";
test("normalizes actual skills without confusing SQL/MySQL or Java/JavaScript", () => {
  const p = getProfile(resume);
  assert.ok(p.skills.includes("React"));
  assert.ok(p.skills.includes("JavaScript"));
  assert.ok(p.roles.includes("Frontend Developer"));
  assert.equal(p.experienceYears, 0);
  assert.deepEqual(p.education, ["bachelors"]);
  assert.ok(p.projects.includes("Built"));
  assert.deepEqual(extractSkills("MySQL, JavaScript, Node.js"), [
    "JavaScript",
    "Node.js",
    "MySQL",
  ]);
});
test("unknown experience stays unknown; education city and projects do not imply work years or location", () => {
  const p = getProfile(
    "Skills: React, CSS\nEducation\nB.Tech, Bengaluru University 2020–2024\nProjects\nReact app 2021–2026\nI want to learn Python.",
  );
  assert.equal(p.experienceYears, null);
  assert.equal(p.preferredLocation, null);
  assert.ok(!p.skills.includes("Python"));
  assert.equal(
    getProfile("I would be a good candidate. Skills: React").education.length,
    0,
  );
  assert.equal(
    getProfile("Preferred location: Pune\nSkills: Python").preferredLocation,
    "pune",
  );
});
test("overlapping work intervals count once and academic dates do not contribute", () => {
  assert.equal(
    getProfile(
      "Work Experience\nEngineer 2020–2023\nDeveloper 2022–2024\nEducation\nB.Tech 2016–2020",
    ).experienceYears,
    4,
  );
});
test("strong match exposes the requested 40/25/20/10/5 calculation", () => {
  const a = getScore(job, getProfile(resume), "Bengaluru");
  assert.equal(a.matchScore, 100);
  assert.equal(a.ineligible, false);
  assert.deepEqual(
    a.breakdown.map((r) => r.effectiveWeight),
    [40, 25, 20, 10, 5],
  );
  assert.equal(a.matchedSkills.length, 3);
  assert.deepEqual(a.requiredSkills, ["React", "JavaScript", "CSS"]);
});
test("partial and unrelated resumes earn no invented skill or role credit", () => {
  const a = getScore(
    job,
    getProfile(
      "Backend Developer\nFresher\nSkills: JavaScript, Node.js, Express\nEducation\nB.Tech",
    ),
    "Bengaluru",
  );
  assert.equal(a.matchScore, 48); // 40/3 + 0 + 20 + 10 + 5 = 48.333...
  assert.deepEqual(a.missingSkills, ["React", "CSS"]);
  assert.equal(
    getScore(
      job,
      getProfile("Accountant with bookkeeping and Excel"),
      "Bengaluru",
    ).matchScore,
    null,
  );
});
test("absent job factors redistribute; unknown applicant qualifications earn no credit", () => {
  const j = {
    ...job,
    description:
      "Required qualifications\nReact and CSS required.\n" +
      "Build responsive interfaces and maintain reusable components with the design team. ".repeat(
        3,
      ),
  };
  const a = getScore(j, getProfile("Frontend Developer\nSkills: React, CSS"));
  assert.equal(a.matchScore, 100);
  assert.equal(
    a.breakdown.find((r) => r.id === "experience").applicable,
    false,
  );
  const unknown = getScore(
    job,
    getProfile("Frontend Developer\nSkills: React, CSS, JavaScript"),
    "Bengaluru",
  );
  assert.equal(
    unknown.breakdown.find((r) => r.id === "experience").contribution,
    0,
  );
  assert.equal(
    unknown.breakdown.find((r) => r.id === "education").contribution,
    0,
  );
});
test("OR skills count once; preferred skills never become mandatory", () => {
  const j = {
    ...job,
    description:
      "Required qualifications\nPython or JavaScript is required.\nPreferred\nDocker and AWS are nice to have.\n" +
      "Develop maintainable software and document changes with clear examples. ".repeat(
        3,
      ),
  };
  assert.deepEqual(getRequirements(j).skillGroups, [["JavaScript", "Python"]]);
  assert.equal(
    getScore(j, getProfile("Software Engineer\nSkills: Python")).missingSkills
      .length,
    0,
  );
});
test("explicit experience or degree ineligibility is excluded; equivalent education is respected", () => {
  assert.equal(
    getScore(
      { ...job, description: description.replace("0 years", "3 years") },
      getProfile(resume),
    ).ineligible,
    true,
  );
  const j = {
    ...job,
    description: description.replace("Bachelor's", "Master's"),
  };
  assert.equal(getScore(j, getProfile(resume)).ineligible, true);
  assert.equal(
    getScore(
      {
        ...j,
        description: j.description.replace(
          "degree required",
          "degree or equivalent work experience required",
        ),
      },
      getProfile(resume),
    ).ineligible,
    false,
  );
});
test("experience ranges use the lower bound; React Native is not a claim of web React", () => {
  assert.equal(
    getRequirements({ ...job, title: "Full Stack Developer 6yrs-12yrs" })
      .minimumExperience,
    6,
  );
  assert.equal(
    getRequirements({
      ...job,
      description: description.replace("0 years", "3 to 5 years"),
    }).minimumExperience,
    3,
  );
  assert.deepEqual(extractSkills("React Native"), ["React Native"]);
});
test("short descriptions, excerpts and missing requirements stay unscored", () => {
  for (const changes of [
    { fullDescription: false },
    { description: "React company" },
    { description: "We are an amazing technology company. ".repeat(10) },
  ])
    assert.equal(
      getScore({ ...job, ...changes }, getProfile(resume)).matchScore,
      null,
    );
});
test("stable scores sort descending with recency ties and null below genuine zero", () => {
  const p = getProfile(resume);
  assert.deepEqual(getScore(job, p, "Pune"), getScore(job, p, "Pune"));
  const rows = [null, 0, 83, 83].map((score, i) => ({
    job: { id: String(i), postedAt: `2026-11-0${i + 1}` },
    analysis: { matchScore: score },
  }));
  assert.deepEqual(
    sortJobs(rows).map((r) => r.job.id),
    ["3", "2", "1", "0"],
  );
});


test("partial scoring is explicit, weighted and still refuses descriptions without requirements", () => {
  const partial = { ...job, fullDescription: false };
  const profile = getProfile(resume);
  const estimated = getScore(partial, profile, "", { allowPartial: true });
  assert.equal(getScore(partial, profile).matchScore, null);
  assert.equal(estimated.matchScore, getScore(job, profile).matchScore);
  assert.equal(estimated.partial, true);
  assert.equal(getScore({ ...partial, description: "React Developer" }, profile, "", { allowPartial: true }).matchScore, null);
  assert.equal(getScore({ ...partial, description: "We build great products. ".repeat(20) }, profile, "", { allowPartial: true }).matchScore, null);
});


test("no applicable scoring factors produce finite zero breakdown values and no score", () => {
  const unknownJob = { title: "Unspecified opportunity", description: "Contact the company for further information. ".repeat(6), location: "", fullDescription: true };
  for (const profile of [getProfile("General applicant"), getProfile(resume)]) {
    const result = getScore(unknownJob, profile, "", { allowPartial: true });
    assert.equal(result.matchScore, null);
    for (const row of result.breakdown) {
      assert.equal(row.applicable, false);
      assert.equal(row.effectiveWeight, 0);
      assert.equal(row.contribution, 0);
      assert.ok(Number.isFinite(row.credit));
    }
    assert.deepEqual(JSON.parse(JSON.stringify(result.breakdown)), result.breakdown);
  }
});
