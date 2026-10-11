import { getErrorMessage, groupAssignments, groupOptions } from "./caseGroups";

describe("getErrorMessage", () => {
  test("reads the error from a JSON response", async () => {
    expect(await getErrorMessage({ response: { data: { error: "No assignments found" } } }, "fallback")).toBe("No assignments found");
  });

  test("reads the error from a blob response", async () => {
    const data = new Blob([JSON.stringify({ error: "No assignments found" })], { type: "application/json" });
    expect(await getErrorMessage({ response: { data } }, "fallback")).toBe("No assignments found");
  });

  test("falls back when there is no response or the blob isn't JSON", async () => {
    expect(await getErrorMessage(new Error("Network Error"), "fallback")).toBe("fallback");
    expect(await getErrorMessage({ response: { data: new Blob(["<html>"]) } }, "fallback")).toBe("fallback");
  });
});

const row = (candidateType, timeSlot, groupNumber, applicantName) => ({
  _id: `${candidateType}${timeSlot}${groupNumber}${applicantName}`,
  candidateType,
  timeSlot,
  groupNumber,
  groupId: `${candidateType}-${timeSlot}-${groupNumber}`,
  applicantName
});

test("groupAssignments nests by track, slot and group, sorted", () => {
  const grouped = groupAssignments(
    [row("Tech", "A", 2, "Zed"), row("Tech", "A", 1, "Bo"), row("Tech", "A", 1, "Al"), row("Non-Tech", "C", 1, "Cy")],
    ["A", "B", "C"]
  );
  expect(grouped.Tech.A.map((g) => g.groupNumber)).toEqual([1, 2]);
  expect(grouped.Tech.A[0].members.map((m) => m.applicantName)).toEqual(["Al", "Bo"]);
  expect(grouped.Tech.B).toEqual([]);
  expect(grouped["Non-Tech"].C[0].groupId).toBe("Non-Tech-C-1");
});

test("groupOptions lists existing groups and a new-group choice per track and slot", () => {
  const grouped = groupAssignments([row("Tech", "A", 1, "Al")], ["A"]);
  expect(groupOptions(grouped, { A: "6:00 PM – 7:00 PM" })).toEqual([
    { value: "Non-Tech|A|new", label: "New Non-Tech group at 6:00 PM – 7:00 PM", track: "Non-Tech", slot: "A", groupNumber: "new" },
    { value: "Tech|A|1", label: "Tech-A-1 (1 person)", track: "Tech", slot: "A", groupNumber: 1 },
    { value: "Tech|A|new", label: "New Tech group at 6:00 PM – 7:00 PM", track: "Tech", slot: "A", groupNumber: "new" }
  ]);
});
