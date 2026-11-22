const { LEGACY_CYCLE, CYCLE_PATTERN } = require('../config/cycleConfig');

// Run with the portal stopped so no write can race the backup or index swap.
async function migrateApplicationCycles(db, { apply = false } = {}) {
  const applications = db.collection('applications');
  const records = await applications.find({}).toArray();
  const seen = new Set();
  for (const record of records) {
    const cycle = record.cycle == null ? LEGACY_CYCLE : record.cycle;
    if (typeof cycle !== 'string' || !CYCLE_PATTERN.test(cycle) || typeof record.email !== 'string' || !record.email.trim()) {
      throw new Error(`Invalid cycle or email on application ${record._id}; fix before migrating.`);
    }
    const key = `${cycle}:${record.email.trim().toLowerCase()}`;
    if (seen.has(key)) throw new Error('Duplicate cycle/email pair; resolve duplicates before migrating.');
    seen.add(key);
  }
  const pending = records.filter(record => record.cycle == null || record.email !== record.email.trim().toLowerCase());
  if (!apply) return { apply: false, applications: records.length, pending: pending.length };

  const backup = db.collection('application_cycle_backups');
  for (const record of pending) {
    await backup.updateOne({ _id: record._id }, { $setOnInsert: { original: record, backedUpAt: new Date() } }, { upsert: true });
  }
  if (await backup.countDocuments({ _id: { $in: pending.map(record => record._id) } }) !== pending.length) {
    throw new Error('Application backup verification failed; no applications changed.');
  }
  for (const record of pending) {
    await applications.updateOne({ _id: record._id }, {
      $set: { cycle: record.cycle == null ? LEGACY_CYCLE : record.cycle, email: record.email.trim().toLowerCase() }
    });
  }
  if (await applications.countDocuments({ $or: [{ cycle: { $exists: false } }, { cycle: null }] })) {
    throw new Error('Applications without a cycle remain; existing indexes retained.');
  }
  await applications.createIndex({ cycle: 1, email: 1 }, { unique: true, name: 'cycle_1_email_1' });
  const indexes = await applications.indexes();
  if (!indexes.some(index => index.unique && Object.keys(index.key).length === 2 && index.key.cycle === 1 && index.key.email === 1)) {
    throw new Error('Compound unique index was not verified; existing indexes retained.');
  }
  for (const index of indexes) {
    if (index.unique && Object.keys(index.key).length === 1 && index.key.email === 1) {
      await applications.dropIndex(index.name);
    }
  }
  return { apply: true, applications: records.length, migrated: pending.length };
}

if (require.main === module) {
  require('dotenv').config();
  const mongoose = require('mongoose');
  (async () => {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
    await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
    try {
      console.log(await migrateApplicationCycles(mongoose.connection.db, { apply: process.argv.includes('--apply') }));
    } finally {
      await mongoose.disconnect();
    }
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { migrateApplicationCycles };
