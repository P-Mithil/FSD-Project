export function retryAfterSeconds(value, now = Date.now()) {
  if (typeof value !== "string" || !value.trim()) return null;
  if (/^\d+(?:\.\d+)?$/.test(value.trim())) {
    const seconds = Number(value);
    return Number.isFinite(seconds) ? Math.ceil(seconds) : null;
  }
  const date = Date.parse(value);
  return Number.isFinite(date)
    ? Math.max(0, Math.ceil((date - now) / 1000))
    : null;
}
