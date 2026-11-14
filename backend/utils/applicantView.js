// Fields an applicant may read back about their own application. Board-only data
// (comments, statusHistory) must never reach the applicant, so this is an allowlist:
// a field added to the model later stays hidden until someone adds it here.
// status stays for now because the view page uses it to lock editing; see SOW B-10.
const APPLICANT_VISIBLE_FIELDS = Object.freeze([
  "_id", "email", "fullName", "phoneNumber", "studentYear", "major", "appliedBefore",
  "candidateType", "reason", "zombieAnswer", "additionalInfo", "caseNightPreferences",
  "resume", "transcript", "image", "status", "createdAt", "updatedAt",
]);

// Returns a plain object with only the applicant-visible fields of a Mongoose document or plain object.
const toApplicantView = (application) => {
  if (!application) return application;
  const source = typeof application.toObject === "function" ? application.toObject() : application;
  const view = {};
  for (const field of APPLICANT_VISIBLE_FIELDS) {
    if (source[field] !== undefined) view[field] = source[field];
  }
  return view;
};

module.exports = { APPLICANT_VISIBLE_FIELDS, toApplicantView };
