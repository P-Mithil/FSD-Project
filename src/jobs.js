import { isIndiaEligible } from "./jobFilters.js";

const JOBS_URL =
  "https://devglobaljobs.com/api/v1/jobs?country=IN&category=technology&limit=100&offset=0";

function getText(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "devglobaljobs.com" &&
      !url.username &&
      !url.password &&
      /^\/jobs\/detail\/\d+\/?$/.test(url.pathname)
      ? value
      : "";
  } catch {
    return "";
  }
}

function descriptionText(value) {
  if (typeof value !== "string") return "";
  let text = value.slice(0, 120000);
  const entities = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    ndash: "–",
    mdash: "—",
    rsquo: "’",
    lsquo: "‘",
    bull: "•",
  };
  for (let pass = 0; pass < 3; pass++)
    text = text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (original, entity) => {
      if (entity[0] !== "#") return entities[entity.toLowerCase()] ?? original;
      const number =
        entity[1].toLowerCase() === "x"
          ? parseInt(entity.slice(2), 16)
          : Number(entity.slice(1));
      return number > 0 && number <= 0x10ffff
        ? String.fromCodePoint(number)
        : "";
    });
  return text
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?(?:p|div|li|br|h[1-6]|ul|ol)\b[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();
}
export async function getJobs(signal) {
  const response = await fetch(JOBS_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  });

  if (!response.ok) {
    throw new Error(
      response.status === 429
        ? "The jobs service is busy. Please try again later."
        : "Jobs could not be loaded. Please try again later.",
    );
  }

  const data = await response.json().catch(() => null);
  if (!Array.isArray(data?.jobs)) {
    throw new Error("The jobs service returned an unexpected response.");
  }

  const jobs = new Map();
  for (const job of data.jobs) {
    if (
      !job ||
      job.country !== "IN" ||
      !/^\d+$/.test(String(job.id)) ||
      !getText(job.title, "") ||
      (job.closingDate && Date.parse(job.closingDate) <= Date.now())
    ) {
      continue;
    }

    const location = getText(job.location, "Location not provided");
    const remote = /\bremote\b/i.test(location + " " + job.title) || job.category === "remote";
    if (!isIndiaEligible(location, remote)) continue;
    const postedAt = typeof job.postedAt === "string" && Number.isFinite(Date.parse(job.postedAt))
      ? new Date(job.postedAt).toISOString() : null;
    const closingDate = typeof job.closingDate === "string" && Number.isFinite(Date.parse(job.closingDate))
      ? new Date(job.closingDate).toISOString() : null;

    jobs.set(String(job.id), {
      id: String(job.id),
      title: job.title.trim(),
      company: getText(job.organization, "Company not provided"),
      location,
      remote,
      postedAt,
      closingDate,
      description: descriptionText(job.description ?? job.descriptionExcerpt),
      type: getText(job.jobType, "Employment type not provided"),
      salary: getText(job.salary, "") || null,
      url: getLink(job.url),
    });
  }
  return [...jobs.values()];
}
