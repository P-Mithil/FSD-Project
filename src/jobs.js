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

    jobs.set(String(job.id), {
      id: String(job.id),
      title: job.title.trim(),
      company: getText(job.organization, "Company not provided"),
      location: getText(job.location, "Location not provided"),
      type: getText(job.jobType, "Employment type not provided"),
      salary: getText(job.salary, "") || null,
      url: getLink(job.url),
    });
  }
  return [...jobs.values()];
}
