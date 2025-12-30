const CASE_NIGHT_CONFIG = {
  slots: {
    A: "6:00 PM-7:00 PM",
    B: "7:00 PM-8:00 PM", 
    C: "8:00 PM-9:00 PM"
  },
  maxCapacity: {
    tech: 200,     // Increased for current volume
    nonTech: 200   // Increased for current volume
  },
  date: "September 10th, 2025",
  groupSize: 4,    // Number of people per case group
  maxGroupsPerSlot: 50  // Maximum groups per time slot (50 * 4 = 200 people)
};

module.exports = CASE_NIGHT_CONFIG; 