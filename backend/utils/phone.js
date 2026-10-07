// Stored phone format: E.164 ("+" then 8-15 digits), e.g. +18585550123
const PHONE_PATTERN = /^\+\d{8,15}$/;

// Turns free-text input like "(858) 555-0123" into E.164, or returns null if it isn't a valid number.
// 10 digits (or 11 starting with 1) are treated as US; anything starting with "+" is kept as international.
const normalizePhone = (raw) => {
  const input = String(raw ?? "").trim();
  const digits = input.replace(/\D/g, "");

  if (input.startsWith("+")) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
};

module.exports = { PHONE_PATTERN, normalizePhone };
