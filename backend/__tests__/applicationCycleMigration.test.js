const { migrateApplicationCycles } = require('../scripts/migrateApplicationCycles');

function database() {
  const original = { _id: 'synthetic-id', email: 'test@ucsd.edu' };
  const applications = {
    find: () => ({ toArray: async () => [original] }),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    countDocuments: jest.fn().mockResolvedValue(0),
    createIndex: jest.fn().mockResolvedValue('cycle_1_email_1'),
    indexes: jest.fn().mockResolvedValue([
      { name: 'email_1', unique: true, key: { email: 1 } },
      { name: 'cycle_1_email_1', unique: true, key: { cycle: 1, email: 1 } }
    ]),
    dropIndex: jest.fn().mockResolvedValue({ ok: 1 })
  };
  const backups = { updateOne: jest.fn().mockResolvedValue({ upsertedCount: 1 }), countDocuments: jest.fn().mockResolvedValue(1) };
  return { applications, backups, db: { collection: name => name === 'applications' ? applications : backups } };
}
test('dry run never writes applications, backups or indexes', async () => {
  const { db, applications, backups } = database();
  expect(await migrateApplicationCycles(db)).toEqual({ apply: false, applications: 1, pending: 1 });
  expect(applications.updateOne).not.toHaveBeenCalled();
  expect(backups.updateOne).not.toHaveBeenCalled();
  expect(applications.createIndex).not.toHaveBeenCalled();
});
test('failed backup verification blocks all application mutations', async () => {
  const { db, applications, backups } = database();
  backups.countDocuments.mockResolvedValue(0);
  await expect(migrateApplicationCycles(db, { apply: true })).rejects.toThrow(/backup verification/);
  expect(applications.updateOne).not.toHaveBeenCalled();
  expect(applications.dropIndex).not.toHaveBeenCalled();
});
test('a failed new index build never removes the existing unique index', async () => {
  const { db, applications } = database();
  applications.createIndex.mockRejectedValue(new Error('index build failed'));
  await expect(migrateApplicationCycles(db, { apply: true })).rejects.toThrow('index build failed');
  expect(applications.dropIndex).not.toHaveBeenCalled();
});
test('a missing new unique index never removes the existing one', async () => {
  const { db, applications } = database();
  applications.indexes.mockResolvedValue([{ name: 'email_1', unique: true, key: { email: 1 } }]);
  await expect(migrateApplicationCycles(db, { apply: true })).rejects.toThrow(/not verified/);
  expect(applications.dropIndex).not.toHaveBeenCalled();
});
