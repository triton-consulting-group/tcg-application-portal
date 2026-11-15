const mongoose = require("mongoose");
const { ensureIndexes } = require("../config/db");

// Register the models so they can be spied on before ensureIndexes runs.
["Admin", "Application", "CaseGroupAssignment", "CaseGroupBackup", "CaseGroupEditLog", "User"]
  .forEach((file) => require(`../models/${file}`));

afterEach(() => jest.restoreAllMocks());

test("builds indexes for every registered model", async () => {
  const spies = mongoose.modelNames().map((name) =>
    jest.spyOn(mongoose.model(name), "createIndexes").mockResolvedValue());
  jest.spyOn(console, "log").mockImplementation(() => {});
  await ensureIndexes();
  expect(mongoose.modelNames()).toEqual(
    expect.arrayContaining(["Admin", "Application", "CaseGroupAssignment", "User"])
  );
  spies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
});

test("a failing index build is logged and does not throw", async () => {
  mongoose.modelNames().forEach((name) =>
    jest.spyOn(mongoose.model(name), "createIndexes").mockResolvedValue());
  jest.spyOn(mongoose.model("Application"), "createIndexes")
    .mockRejectedValue(new Error("E11000 duplicate key"));
  jest.spyOn(console, "log").mockImplementation(() => {});
  const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  await expect(ensureIndexes()).resolves.toBeUndefined();
  expect(errSpy).toHaveBeenCalledWith(
    expect.stringContaining("Application"), "E11000 duplicate key"
  );
});
