// Turns case night preferences from a request body into a clean list of slot IDs, e.g. ["A", "B", "C"].
// Multipart forms send arrays as one comma-joined string ("A,B,C"), so that is split apart here;
// a JSON array string ('["A","B"]') or a real array is accepted too.
const parseCaseNightPreferences = (raw) => {
  let values = raw;

  if (typeof values === "string" && values.trim().startsWith("[")) {
    try {
      values = JSON.parse(values);
    } catch {
      // Not valid JSON; fall through and treat it as comma-separated text
    }
  }

  const list = Array.isArray(values) ? values : [values];
  const slots = list
    .flatMap((value) => (typeof value === "string" ? value.split(",") : []))
    .map((slot) => slot.trim())
    .filter(Boolean);

  return [...new Set(slots)];
};

module.exports = { parseCaseNightPreferences };
