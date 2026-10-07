const { normalizePhone, PHONE_PATTERN } = require("../utils/phone");
const Application = require("../models/Application");

describe("normalizePhone", () => {
  test.each([
    ["8585550123", "+18585550123"],
    ["(858) 555-0123", "+18585550123"],
    ["858.555.0123", "+18585550123"],
    ["1-858-555-0123", "+18585550123"],
    ["+1 858 555 0123", "+18585550123"],
    ["  858-555-0123  ", "+18585550123"],
    ["+44 20 7946 0958", "+442079460958"],
    ["+91 98765 43210", "+919876543210"],
  ])("accepts %p as %p", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
    expect(expected).toMatch(PHONE_PATTERN);
  });

  test.each([
    undefined, null, "", "   ", "555-0123", "28585550123",
    "not a phone", "+123", "+1234567890123456",
  ])("rejects %p", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe("Application schema", () => {
  const valid = {
    email: "  Applicant@UCSD.edu ", fullName: "Test Applicant", phoneNumber: "+18585550123",
    studentYear: "2nd", major: "Economics", appliedBefore: "No", candidateType: "Tech", reason: "Because"
  };

  test("stores email lowercase and trimmed", () => {
    const doc = new Application(valid);
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.email).toBe("applicant@ucsd.edu");
  });

  test("requires a phone number", () => {
    const { phoneNumber, ...withoutPhone } = valid;
    const err = new Application(withoutPhone).validateSync();
    expect(err.errors.phoneNumber).toBeDefined();
  });

  test("rejects a phone number that isn't normalized", () => {
    const err = new Application({ ...valid, phoneNumber: "(858) 555-0123" }).validateSync();
    expect(err.errors.phoneNumber).toBeDefined();
  });

  test("declares a unique index on email", () => {
    const emailIndex = Application.schema.indexes().find(([fields]) => fields.email === 1 && Object.keys(fields).length === 1);
    expect(emailIndex).toBeDefined();
    expect(emailIndex[1].unique).toBe(true);
  });
});
