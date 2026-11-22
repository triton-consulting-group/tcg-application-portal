const mongoose = require("mongoose");
const { ensureIndexes, assertMigrationsComplete } = require("../config/db");

const models = ["Admin", "Application", "CaseGroupAssignment", "CaseGroupBackup",
  "CaseGroupEditLog", "User", "RecruitmentRound", "Room", "Group", "Evaluation"];
models.forEach((name) => require(`../models/${name}`));

beforeEach(() => {
  models.forEach((name) => jest.spyOn(mongoose.model(name), "createIndexes").mockResolvedValue());
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test("creates indexes for all existing and recruitment models", async () => {
  await ensureIndexes();
  models.forEach((name) => expect(mongoose.model(name).createIndexes).toHaveBeenCalledTimes(1));
});

test("refuses startup if a required index fails, while attempting all models", async () => {
  mongoose.model("Application").createIndexes.mockRejectedValue(new Error("Duplicate pair"));
  await expect(ensureIndexes()).rejects.toThrow("Required database indexes");
  models.forEach((name) => expect(mongoose.model(name).createIndexes).toHaveBeenCalledTimes(1));
});

test("declares cycle/email uniqueness instead of global email uniqueness", () => {
  const indexes = mongoose.model("Application").schema.indexes();
  expect(indexes).toContainEqual([ { cycle: 1, email: 1 }, expect.objectContaining({ unique: true }) ]);
  expect(indexes.some(([key, options]) => key.email === 1 && !key.cycle && options.unique)).toBe(false);
});

test.each([
  [1, [], null, null, /migrateApplicationCycles/],
  [0, [{ key: { email: 1 }, unique: true }], null, null, /email-only index/],
  [0, [], { _id: "legacy" }, null, /migrateCaseGroups/]
])("blocks serving unmigrated data", async (count, indexes, assignment, round, message) => {
  const db = { collection: (name) => ({
    countDocuments: async () => count,
    indexes: async () => indexes,
    findOne: async () => name === "casegroupassignments" ? assignment : round
  }) };
  await expect(assertMigrationsComplete(db)).rejects.toThrow(message);
});

test("allows a fresh database with no application collection", async () => {
  const db = { collection: () => ({ countDocuments: async () => 0,
    indexes: async () => { throw Object.assign(new Error("namespace missing"), { code: 26 }); },
    findOne: async () => null }) };
  await expect(assertMigrationsComplete(db)).resolves.toBeUndefined();
});
