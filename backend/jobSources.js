import { normalizeCity, getRoles } from "./score.js";
import { retryAfterSeconds } from "../src/retry.js";

const PROVIDER = "https://devglobaljobs.com";
export const ATTRIBUTION = {
  text: "Powered by Dev Global Jobs",
  url: PROVIDER,
};
export const sourceError = (status, message, seconds = 0) =>
  Object.assign(new Error(message), { status, retryAfterSeconds: seconds });
const MINUTE = 60000;
const CACHE_MS = 10 * MINUTE;

export function descriptionText(value) {
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
export function safeJobUrl(value) {
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
function validDate(value) {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value) &&
    Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : null;
}
export function normalizeJobs(rows, now = Date.now()) {
  if (!Array.isArray(rows)) return [];
  const jobs = new Map();
  for (const raw of rows) {
    if (
      !raw ||
      raw.country !== "IN" ||
      !/^\d+$/.test(String(raw.id)) ||
      typeof raw.title !== "string" ||
      !raw.title.trim()
    )
      continue;
    const url = safeJobUrl(raw.url);
    const closes = validDate(raw.closingDate);
    const postedAt = validDate(raw.postedAt);
    if (
      !url ||
      (closes && Date.parse(closes) <= now) ||
      (postedAt && Date.parse(postedAt) > now + 5 * MINUTE)
    )
      continue;
    const location =
      typeof raw.location === "string" ? raw.location.trim().slice(0, 500) : "";
    // Some country=IN rows describe overseas-only territories. Do not trust that tag alone.
    const remote =
      /\bremote\b/i.test(location) ||
      raw.category === "remote" ||
      /\bremote\b/i.test(raw.title);
    const explicitIndia =
      /\bindia\b|\bworldwide\b|\banywhere\b/i.test(location) &&
      !/british indian ocean/i.test(location);
    const knownCity =
      /bengaluru|bangalore|hyderabad|pune|chennai|mumbai|delhi|noida|gurugram|gurgaon|kolkata|ahmedabad|jaipur|indore|kochi|cochin|chandigarh|coimbatore|bhubaneswar|lucknow|surat|nagpur|thiruvananthapuram/i.test(
        location,
      );
    const foreignOnly =
      /\bunited states\b|\bunited kingdom\b|\bcanada\b|\baustralia\b|british indian ocean/i.test(
        location,
      ) &&
      !explicitIndia &&
      !knownCity;
    if (foreignOnly || (remote && !explicitIndia && !knownCity)) continue;
    if (
      !getRoles(raw.title).length ||
      /sales|recruiter|account executive|business development|finance|tax manager/i.test(
        raw.title,
      )
    )
      continue;
    const description = descriptionText(
      raw.description ?? raw.descriptionExcerpt,
    );
    jobs.set(String(raw.id), {
      id: String(raw.id),
      title: raw.title.trim().slice(0, 220),
      company:
        typeof raw.organization === "string"
          ? raw.organization.slice(0, 180)
          : "Company not supplied",
      location,
      remote,
      salary:
        typeof raw.salary === "string" && raw.salary.trim()
          ? raw.salary.trim().slice(0, 180)
          : null,
      jobType:
        typeof raw.jobType === "string"
          ? raw.jobType.slice(0, 80)
          : "Not specified",
      postedAt,
      closingDate: closes,
      description,
      fullDescription:
        typeof raw.description === "string" &&
        Boolean(raw.description.trim()) &&
        !/(?:…|\.\.\.)\s*$/.test(description),
      url,
      source: "Dev Global Jobs",
      logo: null,
    });
  }
  return [...jobs.values()];
}
export function filterJobs(jobs, filters, now = Date.now()) {
  return jobs.filter((job) => {
    if (job.closingDate && Date.parse(job.closingDate) <= now) return false;
    if (filters.city === "remote" && !job.remote) return false;
    if (
      filters.city &&
      filters.city !== "remote" &&
      !normalizeCity(job.location).includes(normalizeCity(filters.city))
    )
      return false;
    if (
      filters.type === "internship" &&
      !/intern/i.test(job.jobType + " " + job.title)
    )
      return false;
    if (filters.type === "full-time" && !/full[ -]?time/i.test(job.jobType))
      return false;
    if (filters.type === "remote" && !job.remote) return false;
    if (
      filters.level === "fresher" &&
      /\bsenior\b|\bsr\.?\b|\bstaff\b|\blead\b|\bprincipal\b|\bmanager\b|\bdirector\b/i.test(
        job.title,
      )
    )
      return false;
    if (
      filters.days &&
      (!job.postedAt ||
        Date.parse(job.postedAt) < now - filters.days * 86400000)
    )
      return false;
    return true;
  });
}

export function createSource({
  fetchJobs = (...args) => fetch(...args),
  now = Date.now,
} = {}) {
  const cache = new Map();
  const pending = new Map();
  let blockedUntil = 0;
  const recentRequests = [];
  async function request(path) {
    if (cache.get(path)?.expires > now()) return cache.get(path).data;
    if (pending.has(path)) return pending.get(path);
    if (blockedUntil > now())
      throw sourceError(
        429,
        "Dev Global Jobs is rate limited. Existing results are preserved. Retry manually after the cooldown.",
        Math.ceil((blockedUntil - now()) / 1000),
      );
    // Stay below the documented 120/minute quota across different users/searches.
    while (recentRequests.length && recentRequests[0] <= now() - MINUTE)
      recentRequests.shift();
    if (recentRequests.length >= 60) {
      blockedUntil = recentRequests[0] + MINUTE;
      throw sourceError(
        429,
        "The jobs API request budget is cooling down. Please retry shortly.",
        Math.max(1, Math.ceil((blockedUntil - now()) / 1000)),
      );
    }
    recentRequests.push(now());
    const work = (async () => {
      const response = await fetchJobs(`${PROVIDER}${path}`, {
        signal: AbortSignal.timeout(18000),
        headers: { Accept: "application/json" },
      });
      if (response.status === 429) {
        const seconds =
          retryAfterSeconds(response.headers.get("retry-after"), now()) ?? 60;
        blockedUntil = Math.max(
          blockedUntil,
          now() + Math.max(1, seconds) * 1000,
        );
        throw sourceError(
          429,
          "Dev Global Jobs is rate limited. Retry after the cooldown; no automatic retry will run.",
          Math.max(1, seconds),
        );
      }
      if (response.status === 404 || response.status === 410)
        throw sourceError(404, "The source no longer supplies this listing.");
      if (!response.ok)
        throw sourceError(
          502,
          "Dev Global Jobs is temporarily unavailable. Please try again later.",
        );
      const text = await response.text();
      if (text.length > 4 * 1024 * 1024)
        throw sourceError(
          502,
          "The jobs source returned an oversized response.",
        );
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw sourceError(
          502,
          "Dev Global Jobs returned an invalid JSON response.",
        );
      }
      if (cache.size >= 250) cache.delete(cache.keys().next().value);
      cache.set(path, { data, expires: now() + CACHE_MS });
      return data;
    })();
    pending.set(path, work);
    try {
      return await work;
    } catch (error) {
      if (error.status) throw error;
      throw sourceError(
        502,
        "Could not reach Dev Global Jobs. Existing results are preserved.",
      );
    } finally {
      pending.delete(path);
    }
  }
  async function search(query = "") {
    const rows = [];
    let warning = "";
    let retrieved = 0;
    for (let page = 0; page < 2; page++) {
      try {
        const params = new URLSearchParams({
          country: "IN",
          limit: "100",
          offset: String(page * 100),
          category: "technology",
        });
        if (query) params.set("search", query);
        const data = await request(`/api/v1/jobs?${params}`);
        if (
          !Array.isArray(data.jobs) ||
          !data.meta ||
          typeof data.meta.hasMore !== "boolean"
        )
          throw sourceError(
            502,
            "The jobs source returned an unsupported response format.",
          );
        rows.push(...data.jobs);
        retrieved += data.jobs.length;
        if (!data.meta.hasMore || !data.jobs.length) break;
      } catch (error) {
        if (!rows.length) throw error;
        warning = error.message;
        break;
      }
    }
    return {
      jobs: normalizeJobs(rows, now()),
      retrieved,
      warning,
      fetchedAt: new Date(now()).toISOString(),
      attribution: ATTRIBUTION,
    };
  }
  async function detail(job) {
    const raw = await request(`/api/v1/jobs/${job.id}`);
    if (String(raw?.id) !== job.id || typeof raw.description !== "string")
      throw sourceError(502, "A full job description could not be verified.");
    const [verified] = normalizeJobs([raw], now());
    if (!verified)
      throw sourceError(
        404,
        "This listing is closed or no longer verifiably India eligible.",
      );
    return verified;
  }
  return {
    search,
    detail,
    cooldownSeconds: () =>
      Math.max(0, Math.ceil((blockedUntil - now()) / 1000)),
  };
}
