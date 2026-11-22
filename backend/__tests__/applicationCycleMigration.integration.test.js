const mongoose = require('mongoose');
const { migrateApplicationCycles } = require('../scripts/migrateApplicationCycles');
const Application = require('../models/Application');
const uri = process.env.MONGO_TEST_URI;
const local = uri && /^mongodb:\/\/(127\.0\.0\.1|localhost):\d+\//.test(uri);
(local ? describe : describe.skip)('application cycle migration on isolated MongoDB', () => {
  let db;
  beforeAll(async () => { await mongoose.connect(uri, { autoIndex: false }); db = mongoose.connection.db; });
  afterAll(async () => { await mongoose.disconnect(); });
  beforeEach(async () => { await db.dropDatabase(); });
  const record = (email, cycle) => ({ _id: new mongoose.Types.ObjectId(), email, ...(cycle ? { cycle } : {}), fullName: 'Synthetic Applicant', comments: [{ comment: 'Private synthetic note' }], statusHistory: [{ status: 'Under Review' }], resume: '/uploads/synthetic.pdf' });
  test('backs up legacy records, preserves content/IDs and permits repeat applicants in another cycle', async () => {
    const original = record('Test@UCSD.edu');
    await db.collection('applications').insertOne(original);
    await db.collection('applications').createIndex({ email: 1 }, { unique: true });
    expect(await migrateApplicationCycles(db)).toEqual({ apply: false, applications: 1, pending: 1 });
    expect(await db.collection('applications').findOne({ _id: original._id })).toEqual(original);
    await migrateApplicationCycles(db, { apply: true });
    expect((await db.collection('application_cycle_backups').findOne({ _id: original._id })).original).toEqual(original);
    expect(await db.collection('applications').findOne({ _id: original._id })).toEqual({ ...original, cycle: '2026-fall', email: 'test@ucsd.edu' });
    await db.collection('applications').insertOne(record('test@ucsd.edu', '2027-winter'));
    await expect(db.collection('applications').insertOne(record('test@ucsd.edu', '2027-winter'))).rejects.toMatchObject({ code: 11000 });
    expect((await migrateApplicationCycles(db, { apply: true })).migrated).toBe(0);
    expect(await db.collection('application_cycle_backups').countDocuments()).toBe(1);
  });
  test('duplicate normalized emails stop before data/index changes', async () => {
    await db.collection('applications').insertMany([record('Test@ucsd.edu'), record('test@ucsd.edu')]);
    await db.collection('applications').createIndex({ email: 1 }, { unique: true });
    await expect(migrateApplicationCycles(db, { apply: true })).rejects.toThrow(/Duplicate/);
    expect(await db.collection('application_cycle_backups').countDocuments()).toBe(0);
    expect(await db.collection('applications').countDocuments({ cycle: { $exists: false } })).toBe(2);
    expect((await db.collection('applications').indexes()).some(index => index.name === 'email_1')).toBe(true);
  });
  test('new schema declares the database-enforced cycle/email constraint', async () => {
    await Application.createIndexes();
    const indexes = await db.collection('applications').indexes();
    expect(indexes.some(index => index.unique && index.key.cycle === 1 && index.key.email === 1)).toBe(true);
    expect(indexes.some(index => index.unique && Object.keys(index.key).length === 1 && index.key.email === 1)).toBe(false);
  });
});
