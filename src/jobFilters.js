// Reused from the original ResuMate city and listing filters; no resume matching.
export function normalizeCity(value = "") {
  return value
    .toLowerCase()
    .trim()
    .replace(/\bbangalore\b/g, "bengaluru")
    .replace(
      /\b(?:new delhi|delhi ncr|ncr|noida|gurugram|gurgaon)\b/g,
      "delhi",
    );
}

export function isIndiaEligible(location, remote) {
  const explicitIndia = /\bindia\b|\bworldwide\b|\banywhere\b/i.test(location) && !/british indian ocean/i.test(location);
  const knownCity = /bengaluru|bangalore|hyderabad|pune|chennai|mumbai|delhi|noida|gurugram|gurgaon|kolkata|ahmedabad|jaipur|indore|kochi|cochin|chandigarh|coimbatore|bhubaneswar|lucknow|surat|nagpur|thiruvananthapuram/i.test(location);
  const foreignOnly = /\bunited states\b|\bunited kingdom\b|\bcanada\b|\baustralia\b|british indian ocean/i.test(location) && !explicitIndia && !knownCity;
  return !foreignOnly && (!remote || explicitIndia || knownCity);
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
      !/intern/i.test(job.type + " " + job.title)
    )
      return false;
    if (filters.type === "full-time" && !/full[ -]?time/i.test(job.type))
      return false;
    if (filters.type === "remote" && !job.remote) return false;
    if (
      filters.level === "fresher" &&
      /\bsenior\b|\bsr\.?\b|\bstaff\b|\blead\b|\bprincipal\b|\bmanager\b|\bdirector\b/i.test(
        job.title,
      )
    )
      return false;
    const days = filters.days === "any" ? 0 : Number(filters.days);
    if (
      days &&
      (!job.postedAt ||
        Date.parse(job.postedAt) > now ||
        Date.parse(job.postedAt) < now - days * 86400000)
    )
      return false;
    return true;
  });
}
