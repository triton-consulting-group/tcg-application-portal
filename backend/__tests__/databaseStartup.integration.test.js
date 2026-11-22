const mongoose = require("mongoose");
const { ensureIndexes, assertMigrationsComplete } = require("../config/db");
const uri = process.env.MONGO_TEST_URI;
const local = uri && /^mongodb:\/\/(127\.0\.0\.1|localhost):\d+\//.test(uri);

(local ? describe : describe.skip)("automatic indexes on a real MongoDB server", () => {
  beforeAll(async () => {
    await mongoose.connect(uri, { dbName: `dev1_startup_${process.pid}`, autoIndex: false });
    await mongoose.connection.dropDatabase();
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  test("fresh startup creates every model's indexes and can run again", async () => {
    await assertMigrationsComplete(mongoose.connection.db);
    await ensureIndexes();
    await ensureIndexes();
    const applications = await mongoose.model("Application").collection.indexes();
    expect(applications).toContainEqual(expect.objectContaining({ key: { cycle: 1, email: 1 }, unique: true }));
    for (const name of ["RecruitmentRound", "Room", "Group", "Evaluation"]) {
      const indexes = await mongoose.model(name).collection.indexes();
      expect(indexes.some((index) => index.unique)).toBe(true);
    }
  });
});
