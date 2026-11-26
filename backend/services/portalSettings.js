const Settings = require("../models/PortalSettings");
const defaults = require("../config/portalSettingsDefaults");

const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
const object = value => value && typeof value === "object" && !Array.isArray(value);
const text = (value, name, max = 500) => {
  if (typeof value !== "string" || !value.trim() || value.length > max) fail(`${name} must contain 1–${max} characters.`);
  return value.trim();
};
const keys = (value, expected, name) => {
  if (!object(value) || Object.keys(value).length !== expected.length || expected.some(key => !Object.hasOwn(value, key))) fail(`Invalid ${name} fields.`);
};
const date = (value, name) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) fail(`${name} must include a valid date, time, and timezone.`);
  if (new Date(value.slice(0, 10)).toISOString().slice(0, 10) !== value.slice(0, 10)) fail(`${name} contains an invalid calendar date.`);
  return new Date(value).toISOString();
};
const integer = (value, name, max) => {
  if (!Number.isInteger(value) || value < 1 || value > max) fail(`${name} must be a whole number from 1 to ${max}.`);
  return value;
};

function validate(values) {
  keys(values, ["cycleName", "window", "caseNight", "wording"], "settings");
  keys(values.window, Object.keys(defaults.window), "application window");
  keys(values.caseNight, Object.keys(defaults.caseNight), "Case Night");
  keys(values.wording, Object.keys(defaults.wording), "form wording");
  const slots = Object.keys(defaults.caseNight.slots);
  keys(values.caseNight.slots, slots, "slot IDs");
  keys(values.caseNight.maxGroupsPerSlot, slots, "slot capacities");
  if (typeof values.window.isActive !== "boolean") fail("Window enforcement must be true or false.");
  if (values.caseNight.groupSize !== defaults.caseNight.groupSize) fail("The scheduler requires groups of three or four; group size cannot be changed here.");
  const start = date(values.window.applicationStart, "Opening time");
  const end = date(values.window.applicationDeadline, "Deadline");
  if (Date.parse(start) >= Date.parse(end)) fail("The deadline must be after opening time.");
  return {
    cycleName: text(values.cycleName, "Cycle display name", 100),
    window: {
      isActive: values.window.isActive, applicationStart: start, applicationDeadline: end,
      preStartMessage: text(values.window.preStartMessage, "Before-opening message"),
      message: text(values.window.message, "Closed message")
    },
    caseNight: {
      date: text(values.caseNight.date, "Case Night date", 100),
      groupSize: integer(values.caseNight.groupSize, "Group size", 100),
      slots: Object.fromEntries(slots.map(key => [key, text(values.caseNight.slots[key], `Slot ${key}`, 100)])),
      maxGroupsPerSlot: Object.fromEntries(slots.map(key => [key, integer(values.caseNight.maxGroupsPerSlot[key], `Slot ${key} capacity`, 1000)]))
    },
    wording: Object.fromEntries(Object.keys(defaults.wording).map(key => [key, text(values.wording[key], key)]))
  };
}

async function readSettings() {
  const saved = await Settings.findById("portal").lean();
  return saved ? { revision: saved.revision, values: saved.values } : { revision: 0, values: JSON.parse(JSON.stringify(defaults)) };
}

// Each request gets one snapshot. Never mutate a module-global configuration.
async function loadSettings(req, res, next) {
  try {
    req.portalSettings = (await readSettings()).values;
    next();
  } catch (error) {
    res.status(503).json({ error: "Portal settings are unavailable. Please try again." });
  }
}

module.exports = { readSettings, loadSettings, validate };
