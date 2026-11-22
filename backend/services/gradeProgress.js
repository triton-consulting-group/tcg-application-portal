// Grading rules for the progress board. Pure functions, no database access.

// Only applicants invited to a round are graded in it; every other status is off the board
const ROUND_BY_STATUS = {
  "Case Night - Yes": "case_study",
  "Final Interview - Yes": "final_interview"
};
const ROUNDS = ["case_study", "final_interview"];
const GRADED_STATUSES = Object.keys(ROUND_BY_STATUS);
const DECISIONS = ["Yes", "No", "Maybe"];
const REQUIRED_GRADES = 2; // an applicant needs this many grades per round to count as graded

const roundForStatus = (status) => ROUND_BY_STATUS[status] || null;

// Summarizes one applicant's grades for one round, as seen by one reviewer.
// Blind grading: until the viewer has graded this applicant, they only learn how many grades exist,
// never the breakdown or whether it's split. Super admins (canSeeAll) always see everything.
const summarizeGrades = (grades, { viewerEmail, canSeeAll = false, required = REQUIRED_GRADES } = {}) => {
  const viewer = (viewerEmail || "").toLowerCase();
  const mine = grades.find((g) => g.adminEmail === viewer);
  const summary = {
    gradeCount: grades.length,
    ungraded: grades.length < required,
    myDecision: mine ? mine.decision : null
  };
  if (!canSeeAll && !mine) return summary;

  const counts = { Yes: 0, No: 0, Maybe: 0 };
  grades.forEach((g) => { counts[g.decision] += 1; });
  // Any disagreement is a split, Maybe included (Yes+Maybe, No+Maybe, Yes+No)
  const split = DECISIONS.filter((d) => counts[d] > 0).length > 1;
  return { ...summary, counts, split };
};

module.exports = { ROUNDS, GRADED_STATUSES, DECISIONS, REQUIRED_GRADES, roundForStatus, summarizeGrades };
