// The model extracts facts. These fixed rules determine every awarded point.
export const CATEGORIES = [
  { id: "required", label: "Required qualifications", weight: 45 },
  { id: "preferred", label: "Preferred qualifications", weight: 15 },
  { id: "projects", label: "Projects relevance", weight: 20 },
  { id: "experience", label: "Experience relevance", weight: 15 },
  { id: "evidence", label: "Resume evidence", weight: 5 },
];
const CREDIT = { matched: 1, partial: 0.5, missing: 0 };
const normalize = (text) =>
  text
    .toLowerCase()
    .replace(/node\.js/g, "nodejs")
    .replace(/react\.js/g, "react")
    .replace(/express\.js/g, "express")
    .replace(/\bhtml5\b/g, "html")
    .replace(/\bcss3\b/g, "css")
    .replace(/postgresql/g, "postgres")
    .replace(/\brest apis?\b/g, "rest api")
    .replace(/\bjs\b/g, "javascript")
    .replace(/[^a-z0-9+#]+/g, " ")
    .trim();
const containsTerm = (text, term) =>
  ` ${normalize(text)} `.includes(` ${normalize(term)} `);
export function findSourceQuote(source, quote) {
  if (typeof quote !== "string" || !quote.trim()) return "";
  if (source.includes(quote)) return quote;
  // Recover PDF whitespace and typographic hyphens, returning original text.
  // Never accept omitted words or invented technologies or achievements.
  const pattern = quote
    .trim()
    .split(/\s+/)
    .map((word) =>
      word
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/[-\u2010\u2011]/g, "[-\\u2010\\u2011]"),
    )
    .join("\\s+");
  return new RegExp(pattern).exec(source)?.[0] || "";
}
const hasQuote = (source, quote) => Boolean(findSourceQuote(source, quote));

function canonicalTerm(term) {
  const value = normalize(term).replace(/^modern\s+/, "");
  if (/\b(ci cd|github actions)\b/.test(value)) return "ci cd";
  if (/^javascript(?: es6\+?)?$/.test(value)) return "javascript";
  return value;
}
const SKILL_NAMES = {
  react: "React",
  javascript: "JavaScript",
  html: "HTML",
  css: "CSS",
  nodejs: "Node.js",
  express: "Express",
  "rest api": "REST APIs",
  "ci cd": "CI/CD",
};
function requirementKey(fact) {
  if (fact.alternatives.length)
    return [...new Set(fact.alternatives.map(canonicalTerm))].sort().join("|");
  if (/communicat/i.test(fact.name)) return "communication";
  if (/collaborat|teamwork/i.test(fact.name)) return "collaboration";
  if (/debug|troubleshoot/i.test(fact.name)) return "debugging";
  return normalize(fact.name);
}

function isOrGroup(alternatives, quote) {
  const normalized = normalize(quote);
  const positions = alternatives
    .map((term) => ({
      term: normalize(term),
      start: normalized.indexOf(normalize(term)),
    }))
    .sort((a, b) => a.start - b.start);
  return (
    positions.every((item) => item.start >= 0) &&
    positions
      .slice(1)
      .every((item, index) =>
        /\bor\b/.test(
          normalized.slice(
            positions[index].start + positions[index].term.length,
            item.start,
          ),
        ),
      )
  );
}

function qualificationPriority(alternatives, jd, fallback) {
  let section = "";
  const priorities = new Set();
  for (const line of jd.split(/\r?\n/)) {
    if (
      /^\s*(?:required|preferred)\s+(?:qualifications|skills|requirements)\s*:?\s*$/i.test(
        line,
      )
    ) {
      section = /preferred/i.test(line) ? "preferred" : "required";
      continue;
    }
    if (
      /^\s*(?:responsibilities|about the role|recruitment note|benefits)\s*:?\s*$/i.test(
        line,
      )
    )
      section = "";
    if (
      !alternatives.some(
        (term) =>
          containsTerm(line, term) ||
          containsTerm(line, canonicalTerm(term)) ||
          isPlainQualification(term, line) ||
          (canonicalTerm(term) === "ci cd" &&
            /ci\/cd|github actions/i.test(line)),
      )
    )
      continue;
    if (/\b(preferred|optional|nice.to.have|preferably)\b/i.test(line))
      priorities.add("preferred");
    else if (section) priorities.add(section);
  }
  return priorities.has("required")
    ? "required"
    : priorities.has("preferred")
      ? "preferred"
      : fallback;
}

function isPlainQualification(name, quote) {
  // These are semantic abilities, not technology names to compare literally.
  const abilities = [
    /communicat\w*/i,
    /collaborat\w*|teamwork|\bteam\b/i,
    /debug\w*|troubleshoot\w*/i,
    /accessib\w*/i,
    /technical decisions?/i,
  ];
  return abilities.some((pattern) => pattern.test(name) && pattern.test(quote));
}

function categoryQuotes(jd) {
  const quotes = { projects: [], experience: [], evidence: [] };
  let responsibilities = false;
  for (const line of jd.split(/\r?\n/).filter((value) => value.trim())) {
    if (/^\s*responsibilities\s*:?\s*$/i.test(line)) {
      responsibilities = true;
      continue;
    }
    if (
      /^\s*(required qualifications|preferred qualifications|about the role|recruitment note|benefits)\s*:?\s*$/i.test(
        line,
      )
    )
      responsibilities = false;
    // Benefits such as "we find projects for you" do not request a portfolio.
    if (
      /portfolio/i.test(line) ||
      (/\bprojects?\b(?!\s+management)/i.test(line) &&
        /demonstrab\w*|hands[-\s\u2011]on|\bexperience\b|\brelevant\b|\b(built|building|completed|delivered|developed|show|submit|provide|required)\b/i.test(
          line,
        ))
    )
      quotes.projects.push(line);
    if (
      !/\bno (?:prior )?experience (?:is )?(?:needed|required)/i.test(line) &&
      (responsibilities || /\bexperience\b|you will/i.test(line))
    )
      quotes.experience.push(line);
    if (
      /demonstrab\w*|demonstrat\w*|\bproven\b|\bevidence\b|\bexamples?\b|measurable|portfolio/i.test(
        line,
      )
    )
      quotes.evidence.push(line);
  }
  return quotes;
}

export function missingScoringCategories(criteria, jd) {
  const quotes = categoryQuotes(jd);
  return Object.keys(quotes).filter(
    (category) =>
      quotes[category].length &&
      !criteria.some((item) => item.category === category),
  );
}

export function completeEvidenceCategory(criteria, jd) {
  const result = criteria.filter((item) => item.category !== "evidence");
  const jdEvidence = categoryQuotes(jd).evidence[0];
  if (!jdEvidence) return result;
  // Evidence quality is a fixed rubric over verified examples, not another
  // model judgement: concrete action = full, declaration only = half, none = zero.
  const examples = result.filter(
    (item) => item.status !== "missing" && item.resumeEvidence,
  );
  const applied = examples.find((item) =>
    /\b(built|implemented|designed|created|integrated|deployed|presented|resolved|developed|used)\b/i.test(
      item.resumeEvidence,
    ),
  );
  const example = applied || examples[0];
  result.push({
    id: `evidence:${normalize(jdEvidence)}`,
    category: "evidence",
    name: "Concrete resume evidence",
    alternatives: [],
    status: applied ? "matched" : example ? "partial" : "missing",
    matchKind: applied ? "exact" : example ? "partial" : "missing",
    resumeEvidence: example?.resumeEvidence || "",
    jdEvidence,
    explanation: applied
      ? "A verified example describes a concrete action relevant to the role."
      : example
        ? "Relevant knowledge is stated, but no concrete action example supports it."
        : "No verified relevant example is available.",
  });
  return result;
}

// Repair grouping using original JD text, without inventing requirements or
// silently dropping unmet criteria. Semantic interpretation still needs the model.
function prepareCriteria(facts, jd) {
  const prepared = [];
  const lines = jd.split(/\r?\n/).filter((line) => line.trim());
  for (let fact of facts) {
    if (!fact || !["required", "preferred"].includes(fact.category)) {
      prepared.push(fact);
      continue;
    }
    if (
      !Array.isArray(fact.alternatives) ||
      typeof fact.name !== "string" ||
      typeof fact.jdEvidence !== "string" ||
      fact.alternatives.some(
        (term) => typeof term !== "string" || !normalize(term),
      )
    )
      return null;
    fact = { ...fact, jdEvidence: findSourceQuote(jd, fact.jdEvidence) };
    if (fact.jdEvidence && isPlainQualification(fact.name, fact.jdEvidence)) {
      prepared.push({
        ...fact,
        alternatives: [],
        category: qualificationPriority([fact.name], jd, fact.category),
      });
      continue;
    }
    let alternatives = [
      ...new Map(
        fact.alternatives.map((term) => [normalize(term), term]),
      ).values(),
    ];
    if (!alternatives.length) {
      // A model sometimes omits [name] for a single skill. Use only a name
      // (or parenthesized skill) that actually occurs in the quoted JD text.
      const names = [
        fact.name,
        ...Array.from(fact.name.matchAll(/\(([^)]+)\)/g), (match) => match[1]),
      ];
      const name = names.find((term) => containsTerm(jd, term));
      if (name) alternatives = [name];
      else {
        // Non-technology qualifications (communication, relevant experience,
        // etc.) can be evaluated semantically, but still need a real JD quote.
        if (!fact.jdEvidence) return null;
        prepared.push(fact);
        continue;
      }
    }
    // The formal JD may accept MySQL OR PostgreSQL even if an earlier
    // responsibility mentions PostgreSQL alone. Count that accepted group once.
    const families = [
      ["PostgreSQL", "MySQL", "SQLite", "SQL Server"],
      ["AWS", "Vercel"],
      ["React", "Vue", "Angular", "Svelte"],
    ];
    for (const family of families) {
      if (
        !alternatives.some((term) =>
          family.some((known) => canonicalTerm(known) === canonicalTerm(term)),
        )
      )
        continue;
      for (const line of lines) {
        const accepted = family.filter((term) => containsTerm(line, term));
        if (
          accepted.length > 1 &&
          isOrGroup(accepted, line) &&
          alternatives.every((term) =>
            accepted.some(
              (known) => canonicalTerm(known) === canonicalTerm(term),
            ),
          )
        ) {
          alternatives = accepted;
          break;
        }
      }
    }
    const allTerms = (quote) =>
      alternatives.every((term) => containsTerm(quote, term));
    const orLine =
      alternatives.length > 1
        ? lines.find((line) => allTerms(line) && isOrGroup(alternatives, line))
        : null;
    const quote =
      orLine ||
      (hasQuote(jd, fact.jdEvidence) && allTerms(fact.jdEvidence)
        ? fact.jdEvidence
        : lines.find(allTerms));
    if (!quote) {
      if (fact.jdEvidence && isPlainQualification(fact.name, fact.jdEvidence)) {
        prepared.push({
          ...fact,
          alternatives: [],
          category: qualificationPriority([fact.name], jd, fact.category),
        });
        continue;
      }
      return null;
    }
    const category = qualificationPriority(alternatives, jd, fact.category);
    if (alternatives.length > 1 && !isOrGroup(alternatives, quote)) {
      // AND groups must each contribute to the denominator, including missing ones.
      for (const term of alternatives)
        prepared.push({
          ...fact,
          name: term,
          alternatives: [term],
          jdEvidence: quote,
          category: qualificationPriority([term], jd, category),
        });
    } else
      prepared.push({ ...fact, alternatives, jdEvidence: quote, category });
  }
  return prepared;
}
// These families award only transferable (half) credit, never equivalence.
const RELATED_FAMILIES = [
  ["Node.js", "Express", "Flask", "Django", "FastAPI", "Spring", "Rails"],
  ["React", "Vue", "Angular", "Svelte"],
  ["PostgreSQL", "MySQL", "SQLite", "SQL Server"],
  ["JavaScript", "TypeScript"],
];
function transferableEvidence(alternatives, resume) {
  const related = RELATED_FAMILIES.filter((family) =>
    family.some((term) =>
      alternatives.some((accepted) => normalize(accepted) === normalize(term)),
    ),
  )
    .flat()
    .filter(
      (term) =>
        !alternatives.some(
          (accepted) => normalize(accepted) === normalize(term),
        ),
    );
  for (const line of resume.split(/\r?\n/)) {
    const applied =
      /\b(built|developed|implemented|created|used|worked)\b/i.test(line);
    const declared =
      /\b(skills|languages|back.?end|front.?end|databases|frameworks)\b[^:]*:/i.test(
        line,
      );
    if (
      (!applied && !declared) ||
      /\b(no|not|never|without|learning|planned)\b/i.test(line)
    )
      continue;
    const technology = related.find((term) => containsTerm(line, term));
    if (technology)
      return {
        quote: line,
        technology,
        kind: applied ? "experience" : "knowledge",
      };
  }
  return null;
}

export function validateCriteria(facts, resume, jd) {
  if (!Array.isArray(facts) || !facts.length || facts.length > 60) return null;
  facts = prepareCriteria(facts, jd);
  if (!facts || facts.length > 100) return null;
  const seen = new Map();
  const result = [];
  const categorySources = categoryQuotes(jd);
  for (const fact of facts) {
    if (
      !fact ||
      !CATEGORIES.some((category) => category.id === fact.category) ||
      typeof fact.name !== "string" ||
      !fact.name.trim() ||
      typeof fact.explanation !== "string" ||
      !fact.explanation.trim() ||
      !Object.hasOwn(CREDIT, fact.status) ||
      typeof fact.resumeEvidence !== "string" ||
      !hasQuote(jd, fact.jdEvidence) ||
      !Array.isArray(fact.alternatives) ||
      fact.alternatives.some(
        (term) => typeof term !== "string" || !normalize(term),
      )
    )
      return null;
    const skill = ["required", "preferred"].includes(fact.category);
    // Applicability belongs to the whole JD. A relevant duty can describe the
    // project/experience criterion without repeating "project" in that line.
    // The quote must still occur in the JD verbatim (checked above).
    if (!skill && !categorySources[fact.category].length) return null;
    // Each OR group is one criterion, and each accepted alternative must occur in the JD.
    if (
      skill &&
      fact.alternatives.some((term) => !containsTerm(fact.jdEvidence, term))
    )
      return null;
    const technology = skill && fact.alternatives.length > 0;
    const key = `${skill ? "q" : fact.category}:${skill ? requirementKey(fact) : normalize(fact.jdEvidence)}`;
    let resumeEvidence = findSourceQuote(resume, fact.resumeEvidence);
    if (
      technology &&
      (!resumeEvidence ||
        !fact.alternatives.some((term) => containsTerm(resumeEvidence, term)))
    ) {
      const direct = resume
        .split(/\r?\n/)
        .find(
          (line) =>
            !/\b(no|not|never|without|learning|planned)\b/i.test(line) &&
            fact.alternatives.some((term) => containsTerm(line, term)),
        );
      if (direct) resumeEvidence = direct;
    }
    const supported = Boolean(resumeEvidence);
    let status = supported ? fact.status : "missing";
    if (
      technology &&
      supported &&
      fact.alternatives.some((term) => containsTerm(resumeEvidence, term))
    ) {
      status = "matched";
    } else if (technology && status === "matched") {
      // Related technology is transferable evidence, not proof of the requested technology.
      status = "partial";
    }
    const transferable =
      skill && status === "missing"
        ? transferableEvidence(fact.alternatives, resume)
        : null;
    if (transferable) status = "partial";
    if (
      skill &&
      !technology &&
      supported &&
      !/\b(presented|explained|collaborated|coordinated|reviewed|led|documented|resolved|debugged|implemented|worked|built|fixed|communicated|managed)\b/i.test(
        resumeEvidence,
      )
    )
      status = "missing";
    const name =
      technology && fact.alternatives.length === 1
        ? SKILL_NAMES[canonicalTerm(fact.alternatives[0])] || fact.name.trim()
        : technology && fact.alternatives.length > 1
          ? fact.alternatives.join(" or ")
          : fact.name.trim();
    const explanation = transferable
      ? `${transferable.technology} provides related ${transferable.kind}; it does not demonstrate ${name}.`
      : status === "missing"
        ? `No supporting resume evidence was found for ${name}.`
        : technology && status === "matched"
          ? fact.alternatives.length > 1
            ? `Your resume shows an alternative explicitly accepted by the JD.`
            : `Your resume directly shows ${name}.`
          : fact.explanation
              .trim()
              .replace(/\b(required|mandatory|preferred|optional)\s+/gi, "");
    const next = {
      ...fact,
      id: key,
      name,
      status,
      matchKind:
        status === "matched"
          ? fact.alternatives.length > 1
            ? "equivalent"
            : "exact"
          : status,
      category: skill
        ? qualificationPriority(
            [...fact.alternatives, fact.name],
            jd,
            fact.category,
          )
        : fact.category,
      jdEvidence: findSourceQuote(jd, fact.jdEvidence),
      resumeEvidence: transferable?.quote || resumeEvidence,
      explanation,
    };
    if (seen.has(key)) {
      const index = seen.get(key);
      if (CREDIT[next.status] > CREDIT[result[index].status])
        result[index] = next;
    } else {
      seen.set(key, result.length);
      result.push(next);
    }
  }
  return result;
}

export function calculateScore(criteria) {
  if (
    !Array.isArray(criteria) ||
    criteria.some(
      (item) =>
        !item ||
        !Object.hasOwn(CREDIT, item.status) ||
        !CATEGORIES.some((category) => category.id === item.category),
    )
  ) {
    throw new Error("Invalid scoring criteria.");
  }
  const applicable = CATEGORIES.filter((category) =>
    criteria.some((item) => item.category === category.id),
  );
  const totalWeight = applicable.reduce(
    (sum, category) => sum + category.weight,
    0,
  );
  if (!totalWeight) throw new Error("No JD-supported criteria to score.");
  const breakdown = CATEGORIES.map((category) => {
    const items = criteria.filter((item) => item.category === category.id);
    const earned = items.reduce((sum, item) => sum + CREDIT[item.status], 0);
    const score = items.length ? (100 * earned) / items.length : null;
    const weight = items.length ? (category.weight / totalWeight) * 100 : 0;
    return {
      ...category,
      applicable: Boolean(items.length),
      earned,
      possible: items.length,
      score,
      effectiveWeight: weight,
      contribution: score === null ? 0 : (score * weight) / 100,
      deductions: items.filter((item) => item.status !== "matched"),
    };
  });
  // Round once, after summing unrounded category contributions.
  // Remove floating-point noise such as 62.49999999999999 at a half-point boundary.
  const matchScore = Math.round(
    breakdown.reduce((sum, row) => sum + row.contribution, 0) + 1e-10,
  );
  return { matchScore, breakdown };
}

function recommendationTheme(item) {
  const name = `${item.name} ${item.alternatives.join(" ")}`;
  if (/jest|testing library|automated test/i.test(name)) return "testing";
  if (/node\.?js|express|backend/i.test(name)) return "backend";
  if (/docker|ci.cd|github actions/i.test(name)) return "delivery";
  return item.id;
}

export function improvementAction(items) {
  const gaps = items.filter((item) => item.status !== "matched");
  const focus = gaps.length ? gaps : items;
  const qualifications = focus.filter((item) =>
    ["required", "preferred"].includes(item.category),
  );
  const names = (qualifications.length ? qualifications : focus)
    .map((item) => item.name)
    .join(" and ");
  const theme = recommendationTheme(focus[0]);
  const missing = focus.some((item) => item.status === "missing");
  if (theme === "testing")
    return "Write tests for an existing project with the tools listed here, then describe the tests you actually wrote.";
  if (theme === "backend")
    return missing
      ? `Build a small API with ${names} and connect it to a project before listing that experience.`
      : "Describe any backend routes or data handling you have actually implemented. Keep related practice distinct from the requested stack.";
  if (theme === "delivery")
    return `Practice ${names} on a project, then document the deployment or workflow steps you completed.`;
  if (missing && items[0].category === "projects")
    return `Build a project that demonstrates ${names}; describe only the features you complete.`;
  if (missing)
    return `Learn or obtain ${names}, then add a concrete example only after you can demonstrate it.`;
  if (items.some((item) => item.status === "partial"))
    return "Add a concrete example of your own role, the tools used, and the decisions you made. Include only details you can verify.";
  return "Make your role and implementation clear in the existing statement. Include an outcome only when you can verify it.";
}

function recommendations(criteria) {
  const priority = (item) =>
    item.category === "required" && item.status === "missing"
      ? 0
      : ["experience", "projects", "evidence"].includes(item.category) &&
          item.status !== "matched"
        ? 1
        : item.category === "required" && item.status === "partial"
          ? 2
          : item.category === "preferred" && item.status !== "matched"
            ? 3
            : 4;
  const ranked = [...criteria].sort(
    (a, b) => priority(a) - priority(b) || a.id.localeCompare(b.id),
  );
  const groups = [];
  const used = new Set();
  for (const item of ranked) {
    const theme = recommendationTheme(item);
    if (used.has(theme)) continue;
    used.add(theme);
    const items = ranked.filter(
      (candidate) =>
        recommendationTheme(candidate) === theme &&
        (item.status === "matched"
          ? candidate.status === "matched"
          : candidate.status !== "matched"),
    );
    const missing = items.some((candidate) => candidate.status === "missing");
    const type =
      missing && item.category === "projects"
        ? "build_project"
        : missing
          ? "learn_skill"
          : item.status === "partial"
            ? "describe_experience"
            : "improve_wording";
    const titles = {
      testing: "Add automated testing experience",
      backend: "Strengthen backend evidence",
      delivery: "Demonstrate deployment skills",
    };
    const title =
      titles[theme] ||
      `${missing ? "Develop" : item.status === "partial" ? "Demonstrate" : "Clarify"} ${item.name}`;
    const qualifications = items.filter((candidate) =>
      ["required", "preferred"].includes(candidate.category),
    );
    const targets = qualifications.length ? qualifications : items;
    const explanation = `${targets.map((candidate) => candidate.name).join(" and ")} ${targets.length === 1 ? "is" : "are"} part of the role. ${missing ? "Your resume does not yet demonstrate all of this work." : item.status === "partial" ? "The current evidence covers only part of the requirement." : "Clearer wording will make your existing evidence easier to assess."}`;
    groups.push({
      title,
      explanation,
      action: improvementAction(items),
      type,
      category: item.category,
      requirementIds: items.map((candidate) => candidate.id),
    });
    if (groups.length === 3) break;
  }
  // Very short JDs may supply fewer than three distinct requirements.
  const focus = ranked[0];
  const extras = [
    {
      title: "Make your contribution clear",
      action: "State which part you completed yourself and how it worked.",
    },
    {
      title: "Verify the supporting details",
      action:
        "Check that every tool and outcome mentioned is accurate and easy to explain.",
    },
  ];
  for (const extra of extras) {
    if (groups.length === 3) break;
    groups.push({
      ...extra,
      explanation: `Support the role's ${focus.name} requirement with accurate, concrete wording.`,
      type: "improve_wording",
      category: focus.category,
      requirementIds: [focus.id],
    });
  }
  return groups;
}

export function buildMatchResult(criteria) {
  const scoring = calculateScore(criteria);
  const skills = criteria.filter((item) =>
    ["required", "preferred"].includes(item.category),
  );
  const toSkill = (item) => ({
    id: item.id,
    name: item.name,
    explanation: item.explanation,
    evidence: item.resumeEvidence,
    jdEvidence: item.jdEvidence,
    priority: item.category,
    status: item.status,
    matchKind: item.matchKind,
  });
  return {
    ...scoring,
    criteria,
    scoreExplanation:
      "An evidence-based estimate of how your resume meets this role. It is not an official ATS score.",
    matchingSkills: skills
      .filter((item) => item.status === "matched")
      .map(toSkill),
    partialSkills: skills
      .filter((item) => item.status === "partial")
      .map(toSkill),
    missingSkills: skills
      .filter((item) => item.status === "missing")
      .map(toSkill),
    topChanges: recommendations(criteria),
  };
}
