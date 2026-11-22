const { roundForStatus, summarizeGrades, REQUIRED_GRADES } = require("../services/gradeProgress");

const grade = (adminEmail, decision) => ({ adminEmail, decision });
const ME = "me@ucsd.edu";

describe("roundForStatus", () => {
  test("maps the two invited statuses to their rounds", () => {
    expect(roundForStatus("Case Night - Yes")).toBe("case_study");
    expect(roundForStatus("Final Interview - Yes")).toBe("final_interview");
  });

  test.each(["Under Review", "Case Night - No", "Final Interview - No", "Final Interview - Maybe", "Accepted", "Rejected", undefined])(
    "%s is not a graded round",
    (status) => expect(roundForStatus(status)).toBeNull()
  );
});

describe("summarizeGrades", () => {
  test("two grades are the minimum", () => {
    expect(REQUIRED_GRADES).toBe(2);
    expect(summarizeGrades([], { canSeeAll: true }).ungraded).toBe(true);
    expect(summarizeGrades([grade("a@ucsd.edu", "Yes")], { canSeeAll: true }).ungraded).toBe(true);
    expect(summarizeGrades([grade("a@ucsd.edu", "Yes"), grade("b@ucsd.edu", "Yes")], { canSeeAll: true }).ungraded).toBe(false);
  });

  test.each([
    [["Yes", "No"], true],
    [["Yes", "Maybe"], true],
    [["No", "Maybe"], true],
    [["Yes", "No", "Maybe"], true],
    [["Yes", "Yes"], false],
    [["No", "No"], false],
    [["Maybe", "Maybe"], false],
    [["Yes"], false],
    [[], false]
  ])("%j split = %s", (decisions, split) => {
    const grades = decisions.map((d, i) => grade(`r${i}@ucsd.edu`, d));
    expect(summarizeGrades(grades, { canSeeAll: true }).split).toBe(split);
  });

  test("counts each decision", () => {
    const grades = [grade("a@ucsd.edu", "Yes"), grade("b@ucsd.edu", "Yes"), grade("c@ucsd.edu", "Maybe")];
    expect(summarizeGrades(grades, { canSeeAll: true }).counts).toEqual({ Yes: 2, No: 0, Maybe: 1 });
  });

  test("a reviewer who hasn't graded sees only the number of grades", () => {
    const grades = [grade("a@ucsd.edu", "Yes"), grade("b@ucsd.edu", "No")];
    expect(summarizeGrades(grades, { viewerEmail: ME })).toEqual({ gradeCount: 2, ungraded: false, myDecision: null });
  });

  test("after grading, the reviewer sees the breakdown, the split and their own grade", () => {
    const grades = [grade("a@ucsd.edu", "Yes"), grade(ME, "Maybe")];
    expect(summarizeGrades(grades, { viewerEmail: ME })).toEqual({
      gradeCount: 2,
      ungraded: false,
      myDecision: "Maybe",
      counts: { Yes: 1, No: 0, Maybe: 1 },
      split: true
    });
  });

  test("matches the viewer's email case-insensitively", () => {
    const summary = summarizeGrades([grade(ME, "No")], { viewerEmail: "Me@UCSD.edu" });
    expect(summary.myDecision).toBe("No");
    expect(summary.counts).toEqual({ Yes: 0, No: 1, Maybe: 0 });
  });

  test("super admins always see everything", () => {
    const summary = summarizeGrades([grade("a@ucsd.edu", "Yes"), grade("b@ucsd.edu", "No")], { viewerEmail: ME, canSeeAll: true });
    expect(summary).toMatchObject({ myDecision: null, counts: { Yes: 1, No: 1, Maybe: 0 }, split: true });
  });
});
