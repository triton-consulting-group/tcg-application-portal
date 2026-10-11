const { parseCaseNightPreferences } = require("../utils/caseNightPreferences");

// Warnings for a hand edit to case groups. The admin sees these and can still go ahead.
//   application: the applicant being added/moved/removed ({ fullName, candidateType, caseNightPreferences })
//   target:      the group they're going to ({ track, slot }), or null when removing
//   source:      the group they're leaving ({ groupId, remaining }), or null when adding
//   emailsSent:  whether case group emails already went out for an affected group
const checkEditWarnings = ({ application, target, source, emailsSent, config }) => {
  const warnings = [];
  const name = application?.fullName || "This applicant";

  if (application && target) {
    const prefs = parseCaseNightPreferences(application.caseNightPreferences);
    if (!prefs.includes(target.slot)) {
      warnings.push({
        code: "slot-unavailable",
        message: `${name} didn't mark ${config.slots[target.slot] || target.slot} as available.`
      });
    }
    if (application.candidateType !== target.track) {
      warnings.push({
        code: "track-mismatch",
        message: `${name} is ${application.candidateType || "not on a track"}, but this is a ${target.track} group.`
      });
    }
  }

  if (source && source.remaining > 0 && source.remaining < 3) {
    warnings.push({
      code: "small-group",
      message: `This leaves ${source.groupId} with ${source.remaining} member${source.remaining === 1 ? "" : "s"}.`
    });
  }

  if (emailsSent) {
    warnings.push({
      code: "emails-sent",
      message: "Case group emails were already sent for this group. This change won't be emailed."
    });
  }

  return warnings;
};

module.exports = { checkEditWarnings };
