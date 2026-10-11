const { parseCaseNightPreferences } = require("../utils/caseNightPreferences");

describe("parseCaseNightPreferences", () => {
  test.each([
    // Multipart forms join arrays with commas; this is the bug that saved ["A,B,C"]
    ["A,B,C", ["A", "B", "C"]],
    ["A", ["A"]],
    [" A , B ", ["A", "B"]],
    ["A,,B,", ["A", "B"]],
    ['["A","C"]', ["A", "C"]],
    [["A", "B"], ["A", "B"]],
    [["A,B", "C"], ["A", "B", "C"]],
    ["A,A,B", ["A", "B"]],
  ])("parses %p as %p", (input, expected) => {
    expect(parseCaseNightPreferences(input)).toEqual(expected);
  });

  test.each([undefined, null, "", "   ", [], "[]"])("returns [] for %p", (input) => {
    expect(parseCaseNightPreferences(input)).toEqual([]);
  });

  test("does not throw on malformed JSON", () => {
    expect(parseCaseNightPreferences("[A,B")).toEqual(["[A", "B"]);
  });
});
