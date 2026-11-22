import { formatPhone, replaceApplication } from "./applications";

const list = [
  { _id: "a", fullName: "Ada", status: "Under Review", comments: [{ comment: "hi" }] },
  { _id: "b", fullName: "Ben", status: "Under Review", comments: [] },
];

test("merges the updated application into the matching entry", () => {
  const updated = { _id: "b", status: "Case Night - Yes", statusHistory: [{ status: "Case Night - Yes" }] };
  const result = replaceApplication(list, updated);
  expect(result[1]).toEqual({ ...list[1], ...updated });
  expect(result[0]).toBe(list[0]); // untouched entries keep their identity
});

test("returns a new array and leaves the original list alone", () => {
  const result = replaceApplication(list, { _id: "a", status: "Accepted" });
  expect(result).not.toBe(list);
  expect(list[0].status).toBe("Under Review");
  expect(result[0].status).toBe("Accepted");
});

test("ignores a response without an _id", () => {
  expect(replaceApplication(list, undefined)).toBe(list);
  expect(replaceApplication(list, {})).toBe(list);
});

test("leaves the list unchanged when the id isn't present", () => {
  expect(replaceApplication(list, { _id: "zzz", status: "Accepted" })).toEqual(list);
});

describe("formatPhone", () => {
  test("formats US numbers", () => {
    expect(formatPhone("+18585550123")).toBe("(858) 555-0123");
  });

  test("leaves international numbers as stored", () => {
    expect(formatPhone("+447911123456")).toBe("+447911123456");
  });

  test("says when there is no phone number", () => {
    expect(formatPhone(undefined)).toBe("Not provided");
    expect(formatPhone("")).toBe("Not provided");
  });
});
