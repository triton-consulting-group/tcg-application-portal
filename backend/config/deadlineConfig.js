const DEADLINE_CONFIG = {
  // Window control toggle
  isActive: true,

  // Application window start (ISO8601 with timezone)
  // Example below keeps apps closed until 2025-10-09 8:00pm PDT
  applicationStart: "2025-10-09T20:00:00-07:00",

  // Application deadline (ISO8601 with timezone)
  // Adjust as needed; example below is a placeholder
  applicationDeadline: "2025-10-11T12:00:00-07:00",

  // Messages
  preStartMessage: "Applications are not open yet. Please check back later!",
  message: "Applications are currently closed. Thank you for your interest in TCG!",
};

module.exports = DEADLINE_CONFIG;

