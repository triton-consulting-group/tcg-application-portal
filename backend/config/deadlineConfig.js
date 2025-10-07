const DEADLINE_CONFIG = {
  // Application deadline: Saturday noon EST (2 days after Thursday info night)
  applicationDeadline: "2025-10-11T12:00:00-12:00", // Saturday noon EST
  isActive: false, // Easy toggle for testing/debugging (should be true for production)
  message: "Applications are now closed. Thank you for your interest in TCG!",
  
  // Timezone information for reference
  timezone: "PST (Pacific Standard Time)",
  
  // Future cycles: Update the applicationDeadline date above
  // Format: YYYY-MM-DDTHH:mm:ss-HH:mm (ISO 8601 with timezone)
  // Example: "2026-09-12T12:00:00-05:00" for next year
};

module.exports = DEADLINE_CONFIG;
