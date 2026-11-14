const DEADLINE_CONFIG = {
  // Window control toggle
  isActive: true,

  // Application window start (ISO8601 with timezone)
  // Thursday, October 8, 2026 at 11:59 PM PDT
  applicationStart: "2026-10-08T23:59:00-07:00",

  // Application deadline (ISO8601 with timezone)
  // Saturday, October 10, 2026 at 11:59 PM PDT
  applicationDeadline: "2026-10-10T23:59:00-07:00",

  // Messages
  preStartMessage: "Applications are not open yet. Please check back later!",
  message: "Applications are currently closed. Thank you for your interest in TCG!",
};

module.exports = DEADLINE_CONFIG;

