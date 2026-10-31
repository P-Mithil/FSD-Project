import { createHash } from "node:crypto";
import {
  createSource,
  filterJobs,
  sourceError,
  ATTRIBUTION,
} from "./jobSources.js";
import { getProfile, extractSkills, getScore, sortJobs } from "./score.js";

function getFilters(query = {}) {
  const { city = "", type = "any", days = "7", level = "all" } = query;
  if (
    typeof city !== "string" ||
    city.length > 60 ||
    !/^[\p{L} .-]*$/u.test(city) ||
    !["any", "internship", "full-time", "remote"].includes(type) ||
    !["1", "3", "7", "30", "any"].includes(String(days)) ||
    !["all", "fresher"].includes(level) ||
    Object.keys(query).some(
      (key) => !["city", "type", "days", "level"].includes(key),
    )
  )
    throw sourceError(
      400,
      "Use a valid city, job type, experience filter and posting-date window.",
    );
  return {
    city: city.trim(),
    type,
    days: days === "any" ? 0 : Number(days),
    level,
  };
}

export function createJobHandlers(options = {}) {
  const source = createSource(options);
  const profiles = new Map();
  const matches = new Map();
  const pending = new Map();
  const now = options.now || Date.now;
  const MAX_DETAILS = 20;
  const responseBase = () => ({
    attribution: ATTRIBUTION,
    retryAfterSeconds: source.cooldownSeconds(),
    maxDetailed: MAX_DETAILS,
  });
  function sendError(res, error) {
    const seconds = error.retryAfterSeconds || source.cooldownSeconds();
    if (seconds) res.setHeader("Retry-After", String(seconds));
    return res.status(error.status || 502).json({
      error: error.status
        ? error.message
        : "The jobs request could not finish. Please try again.",
      ...responseBase(),
      retryAfterSeconds: seconds,
    });
  }
  async function getJobs(req, res) {
    try {
      const filters = getFilters(req.query);
      const feed = await source.search();
      return res.json({
        ...feed,
        jobs: filterJobs(feed.jobs, filters, now()),
        ...responseBase(),
        notice:
          "A bounded India technology-job pool; local city filters do not search every vacancy in that city.",
      });
    } catch (error) {
      return sendError(res, error);
    }
  }
  async function compare(resumeText, filters) {
    for (const [key, entry] of profiles)
      if (entry.expires <= now()) profiles.delete(key);
    for (const [key, entry] of matches)
      if (entry.expires <= now()) matches.delete(key);
    const hash = createHash("sha256").update(resumeText).digest("hex");
    let profile = profiles.get(hash);
    if (!profile || profile.expires <= now()) {
      if (profiles.size >= 10) profiles.delete(profiles.keys().next().value);
      profile = {
        data: getProfile(resumeText),
        expires: now() + 30 * 60000,
      };
      profiles.set(hash, profile);
    }
    const key = hash + JSON.stringify(filters);
    const cached = matches.get(key);
    if (cached?.expires > now())
      return { ...cached.data, cached: true, ...responseBase() };
    if (pending.has(key)) return pending.get(key);
    const work = (async () => {
      if (!profile.data.skills.length)
        return {
          profile: profile.data,
          results: [],
          explore: [],
          excluded: 0,
          retrieved: 0,
          warning:
            "No identifiable technical skills were found. Review the extracted resume text or add specific technologies you have used.",
          ...responseBase(),
        };
      const query =
        profile.data.skills.find((skill) =>
          [
            "React",
            "Python",
            "Java",
            "Node.js",
            "Angular",
            "Vue",
            "Flutter",
            "PHP",
          ].includes(skill),
        ) ||
        profile.data.roles[0]?.split(" ")[0] ||
        "software";
      const feed = await source.search(query);
      const candidates = filterJobs(feed.jobs, filters, now())
        .map((job) => ({
          job,
          overlap: extractSkills(job.title + " " + job.description).filter(
            (skill) => profile.data.skills.includes(skill),
          ).length,
        }))
        .sort(
          (a, b) =>
            b.overlap - a.overlap ||
            (Date.parse(b.job.postedAt) || 0) -
              (Date.parse(a.job.postedAt) || 0),
        );
      const results = [];
      const explore = [];
      let excluded = 0;
      let warning = feed.warning;

      function addJob(job, reason = "", partial = false) {
        const analysis = getScore(
          partial ? { ...job, fullDescription: false } : job,
          profile.data,
          filters.city,
          { allowPartial: true },
        );
        if (analysis.ineligible) {
          excluded++;
          return;
        }
        if (Number.isFinite(analysis.matchScore)) {
          results.push({ job, analysis });
          return;
        }
        if (!reason) {
          if (!job.fullDescription) {
            reason = "The source supplied an incomplete or truncated description. Skills below reflect only the available text; no percentage was calculated.";
          } else if (job.description.length < 180) {
            reason = "The job description is too short for a reliable percentage. Skills below reflect only the available text.";
          } else {
            reason = "No explicit technical requirements could be verified in the supplied description; no percentage was calculated.";
          }
        }
        explore.push({ job, reason, analysis: { ...analysis, breakdown: null } });
      }

      const deadline = now() + 70000;
      for (let index = 0; index < candidates.length; index++) {
        let job = candidates[index].job;
        if (index >= MAX_DETAILS || now() >= deadline) {
          addJob(job, "Full description not evaluated in this batch. Any skills below come only from the available source text.", true);
          continue;
        }
        try {
          job = await source.detail(job);
        } catch (error) {
          if (error.status === 404) {
            excluded++;
            continue;
          }
          warning = error.message;
          addJob(job, "Full description unavailable; no score assigned. Any skills below come only from the available source text.", true);
          continue;
        }
        if (!filterJobs([job], filters, now()).length) {
          excluded++;
          continue;
        }
        addJob(job);
      }
      const data = {
        profile: profile.data,
        results: sortJobs(results),
        explore,
        excluded,
        retrieved: feed.retrieved,
        relevant: candidates.length,
        evaluated: results.length,
        fetchedAt: feed.fetchedAt,
        warning,
        cached: false,
        notice: `Up to 200 source listings and ${MAX_DETAILS} full descriptions per search. Scores estimate compatibility, not hiring probability.`,
        ...responseBase(),
      };
      if (matches.size >= 20) matches.delete(matches.keys().next().value);
      if (!warning) matches.set(key, { data, expires: now() + 10 * 60000 });
      return data;
    })();
    pending.set(key, work);
    try {
      return await work;
    } finally {
      pending.delete(key);
    }
  }
  async function matchJobs(req, res) {
    if (!req.is("application/json"))
      return res
        .status(415)
        .json({ error: "Send resumeText and filters as JSON." });
    try {
      const { resumeText, filters: rawFilters = {} } = req.body || {};
      if (
        typeof resumeText !== "string" ||
        !resumeText.trim() ||
        resumeText.length > 15000
      )
        throw sourceError(
          400,
          "Add a resume of up to 15,000 characters. Browsing remains available without a resume.",
        );
      if (
        !rawFilters ||
        typeof rawFilters !== "object" ||
        Array.isArray(rawFilters)
      )
        throw sourceError(400, "Send a valid filter object.");
      const filters = getFilters(rawFilters);
      res.setHeader("Cache-Control", "no-store");
      const data = await compare(resumeText.trim(), filters);
      if (data.retryAfterSeconds)
        res.setHeader("Retry-After", String(data.retryAfterSeconds));
      return res.json(data);
    } catch (error) {
      return sendError(res, error);
    }
  }
  return { getJobs, matchJobs };
}
