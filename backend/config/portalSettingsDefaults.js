const window = require("./deadlineConfig");
const caseNight = require("./caseNightConfig");

module.exports = {
  cycleName: "TCG FALL 2026 RECRUITMENT",
  window,
  caseNight,
  wording: {
    email: "Email (UCSD email required)", fullName: "Full Name", phoneNumber: "Phone Number",
    studentYear: "What year are you?", major: "What is your major?",
    appliedBefore: "Have you applied to TCG before?",
    candidateType: "Are you applying as a tech candidate or non-tech candidate?",
    resume: "Please submit your resume", transcript: "Please submit your most recent college transcript.",
    transcriptHelp: "If you are currently a freshman, please attach a copy of your high school transcript.",
    image: "Please upload a profile picture (must be professional) (JPG/PNG)",
    reason: "Why do you want to join TCG?",
    zombieAnswer: "How are you surviving the zombie apocalypse?",
    additionalInfo: "Is there anything else that you think you should let us know?",
    caseNightPreferences: "What is your availability for Case Night?"
  }
};
