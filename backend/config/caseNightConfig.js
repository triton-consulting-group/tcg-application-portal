const CASE_NIGHT_CONFIG = {
  // Time slots available for case night
  // Keys are treated as slot IDs everywhere in the assignment logic
  slots: {
    A: "6:00 PM – 7:00 PM",
    B: "7:00 PM – 8:00 PM",
    C: "8:00 PM – 9:00 PM"
  },

  // Date of the event (display only)
  date: "September 10th, 2025",

  // Number of candidates per case group
  groupSize: 4,

  // Maximum number of case groups allowed per slot
  // Capacity per slot = maxGroupsPerSlot[slot] * groupSize
  maxGroupsPerSlot: {
    A: 50,
    B: 50,
    C: 50
  }
};

module.exports = CASE_NIGHT_CONFIG;
