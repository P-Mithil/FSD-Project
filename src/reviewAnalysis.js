import { calculateScore } from "./matching.js";

export function locateAnnotations(text, annotations) {
  const located = annotations
    .map((item) => ({ ...item, start: text.indexOf(item.quote) }))
    .filter((item) => item.quote && item.start >= 0)
    .sort((a, b) => a.start - b.start || b.quote.length - a.quote.length);
  let end = 0;
  return located.filter((item) => {
    if (item.start < end) return false;
    end = item.start + item.quote.length;
    return true;
  });
}

export function isAnalysisResult(data) {
  const text = (value) => typeof value === "string";
  const list = (items, keys) =>
    Array.isArray(items) &&
    items.every((item) => item && keys.every((key) => text(item[key])));
  const basic = Boolean(
    data &&
      Number.isFinite(data.matchScore) &&
      data.matchScore >= 0 &&
      data.matchScore <= 100 &&
      text(data.scoreExplanation) &&
      list(data.matchingSkills, ["name", "explanation", "evidence"]) &&
      list(data.missingSkills, ["name", "explanation", "evidence"]) &&
      list(data.partialSkills, ["name", "explanation", "evidence"]) &&
      list(data.criteria, [
        "category",
        "name",
        "status",
        "explanation",
        "jdEvidence",
        "resumeEvidence",
      ]) &&
      data.criteria.length > 0 &&
      Array.isArray(data.breakdown) &&
      data.breakdown.length === 5 &&
      data.breakdown.every(
        (row) =>
          Number.isFinite(row.contribution) &&
          Number.isFinite(row.effectiveWeight),
      ) &&
      Math.round(
        data.breakdown.reduce((sum, row) => sum + row.contribution, 0) + 1e-10,
      ) === data.matchScore &&
      list(data.annotations, [
        "quote",
        "explanation",
        "suggestion",
        "jdRelation",
        "jdEvidence",
      ]) &&
      list(data.topChanges, ["title", "explanation", "action", "type"]) &&
      data.topChanges.length === 3,
  );
  if (!basic) return false;
  const byId = new Map(data.criteria.map((item) => [item.id, item]));
  if (
    byId.size !== data.criteria.length ||
    data.criteria.some((item) => typeof item.id !== "string")
  )
    return false;
  const skills = [
    ...data.matchingSkills,
    ...data.partialSkills,
    ...data.missingSkills,
  ];
  if (
    new Set(skills.map((item) => item.id)).size !== skills.length ||
    skills.length !==
      data.criteria.filter((item) =>
        ["required", "preferred"].includes(item.category),
      ).length
  )
    return false;
  const validIds = (ids) =>
    Array.isArray(ids) && ids.every((id) => byId.has(id));
  for (const [status, items] of [
    ["matched", data.matchingSkills],
    ["partial", data.partialSkills],
    ["missing", data.missingSkills],
  ]) {
    if (
      items.some(
        (item) =>
          !byId.has(item.id) ||
          byId.get(item.id).category !== item.priority ||
          byId.get(item.id).name !== item.name ||
          byId.get(item.id).status !== status,
      )
    )
      return false;
  }
  if (data.topChanges.some((item) => !validIds(item.requirementIds)))
    return false;
  if (
    data.annotations.some(
      (item) => item.requirementIds && !validIds(item.requirementIds),
    )
  )
    return false;
  try {
    const expected = calculateScore(data.criteria);
    return (
      expected.matchScore === data.matchScore &&
      expected.breakdown.every(
        (row, index) =>
          row.id === data.breakdown[index].id &&
          ["score", "effectiveWeight", "contribution"].every((key) =>
            row[key] === null
              ? data.breakdown[index][key] === null
              : Math.abs(row[key] - data.breakdown[index][key]) < 1e-8,
          ),
      )
    );
  } catch {
    return false;
  }
}
