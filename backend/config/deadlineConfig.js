const DEADLINE_CONFIG = {
  // Window control toggle
  isActive: true,

  // Application window start (ISO8601 with timezone)
  // Monday, January 12, 2026 at 8:00 PM PST
  applicationStart: "2026-01-12T20:00:00-08:00",

  // Application deadline (ISO8601 with timezone)
  // Thursday, January 15, 2026 at 11:59 PM PST
  applicationDeadline: "2026-01-15T23:59:00-08:00",

  // Messages
  preStartMessage: "Applications are not open yet. Please check back later!",
  message: "Applications are currently closed. Thank you for your interest in TCG!",
};

module.exports = DEADLINE_CONFIG;

