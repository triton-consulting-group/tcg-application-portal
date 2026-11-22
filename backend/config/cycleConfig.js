const LEGACY_CYCLE = "2026-fall";
const CYCLE_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

function getActiveCycle() {
  const cycle = process.env.ACTIVE_RECRUITMENT_CYCLE || LEGACY_CYCLE;
  if (!CYCLE_PATTERN.test(cycle)) throw new Error("Invalid ACTIVE_RECRUITMENT_CYCLE");
  return cycle;
}

function selectCycle(req, res, next) {
  const cycle = req.query.cycle === undefined ? getActiveCycle() : req.query.cycle;
  if (typeof cycle !== "string" || !CYCLE_PATTERN.test(cycle)) {
    return res.status(400).json({ error: "Invalid recruitment cycle." });
  }
  req.cycle = cycle;
  next();
}

module.exports = { LEGACY_CYCLE, CYCLE_PATTERN, getActiveCycle, selectCycle };
