const mongoose = require('mongoose');
const Application = require('../models/Application');
const RecruitmentRound = require('../models/RecruitmentRound');
const Room = require('../models/Room');
const Group = require('../models/Group');
const Evaluation = require('../models/Evaluation');
const CaseGroupAssignment = require('../models/CaseGroupAssignment');
const CaseGroupBackup = require('../models/CaseGroupBackup');
const CaseGroupEditLog = require('../models/CaseGroupEditLog');
const { migrateCaseGroups } = require('../scripts/migrateCaseGroups');
const { ensureRound } = require('../services/recruitmentRounds');
const { listAssignments, replaceAssignments, editAssignment, getExistingStatus } = require('../services/caseGroupStore');
const { loadPreview, finalizeRound, saveEvaluation } = require('../services/roundFinalization');
const uri = process.env.MONGO_TEST_URI;
const local = uri && /^mongodb:\/\/(127\.0\.0\.1|localhost):\d+\//.test(uri);
const models = [Application, RecruitmentRound, Room, Group, Evaluation, CaseGroupAssignment, CaseGroupBackup, CaseGroupEditLog];

(local ? describe : describe.skip)('recruitment rounds on an isolated MongoDB replica set', () => {
  let counter = 0;
  beforeAll(async () => {
    const url = new URL(uri);
    url.pathname = `/dev1_rounds_${process.pid}`;
    await mongoose.connect(url.toString(), { autoIndex: false });
    for (const model of models) await model.createIndexes();
  }, 30000);
  afterAll(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  beforeEach(async () => { for (const model of models) await model.deleteMany({}); });
  afterEach(() => jest.restoreAllMocks());

  const applicant = (cycle = '2026-fall', status = 'Case Night - Yes') => Application.create({
    cycle, email: `synthetic${++counter}@example.test`, fullName: `Synthetic ${counter}`, phoneNumber: '+18585550123',
    studentYear: '2nd', major: 'Economics', appliedBefore: 'No', candidateType: 'Tech', reason: 'Synthetic test data',
    caseNightPreferences: ['A', 'B', 'C'], status
  });
  const assignment = (app, extra = {}) => ({
    applicationId: app._id, applicantName: app.fullName, applicantEmail: app.email, candidateType: 'Tech',
    timeSlot: 'A', timeSlotDisplay: 'Synthetic slot A', groupNumber: 1, groupId: 'Tech-A-1',
    assignedBy: 'board@example.test', ...extra
  });
  const gradedRound = async (kind = 'case-night', cycle = '2026-fall') => {
    const app = await applicant(cycle, kind === 'case-night' ? 'Case Night - Yes' : 'Final Interview - Yes');
    const round = await ensureRound(cycle, kind);
    const group = await Group.create({ cycle, roundId: round._id, candidateType: 'Tech', timeSlot: 'A', timeSlotDisplay: 'Synthetic slot A', groupNumber: 1, groupId: 'Tech-A-1', members: [assignment(app)] });
    await saveEvaluation(round, { applicationId: String(app._id), result: 'Pass', notes: 'Initial grade' }, 'grader@example.test');
    const decisions = [{ applicationId: String(app._id), result: 'Pass' }];
    const preview = await loadPreview(round, decisions);
    return { app, round, group, decisions, preview };
  };

  test('migration keeps original assignment metadata, backup, logs and history; retry does nothing', async () => {
    const app = await applicant();
    const original = await CaseGroupAssignment.create(assignment(app, { emailSent: true, emailSentAt: new Date('2026-11-01T00:00:00Z'), lastEditedBy: 'editor@example.test', lastEditedAt: new Date('2026-11-02T00:00:00Z'), notes: 'Keep this note' }));
    const other = await gradedRound('case-night', '2027-winter');
    const historicalLog = { _id: new mongoose.Types.ObjectId(), action: 'move', by: 'earlier@example.test', applicationId: app._id, from: 'Tech-B-1', to: 'Tech-A-1', at: new Date('2026-11-02T00:00:00Z') };
    const historicalBackup = { _id: new mongoose.Types.ObjectId(), assignments: [{ oldField: 'Preserve legacy backup contents', applicationId: app._id }], replacedBy: 'earlier@example.test', replacedAt: new Date('2026-11-01T00:00:00Z') };
    await CaseGroupEditLog.collection.insertOne(historicalLog);
    await CaseGroupBackup.collection.insertOne(historicalBackup);
    expect(await migrateCaseGroups()).toEqual({ dryRun: true, assignments: 1, groups: 1 });
    expect(await Group.countDocuments({ cycle: '2026-fall' })).toBe(0);
    await migrateCaseGroups({ apply: true, actor: 'migration@example.test' });
    const [migrated] = await listAssignments('2026-fall', false);
    expect(String(migrated._id)).toBe(String(original._id));
    expect(migrated).toMatchObject({ emailSent: true, lastEditedBy: 'editor@example.test', notes: 'Keep this note' });
    expect(migrated.emailSentAt).toEqual(original.emailSentAt);
    const backup = await CaseGroupBackup.findOne({ cycle: '2026-fall', replacedBy: 'migration@example.test' }).lean();
    expect(backup.assignments[0]).toMatchObject({ _id: original._id, applicantEmail: app.email, notes: 'Keep this note' });
    expect(await CaseGroupAssignment.countDocuments()).toBe(1);
    const migratedRound = await RecruitmentRound.findOne({ cycle: '2026-fall', kind: 'case-night' });
    expect(await CaseGroupEditLog.collection.findOne({ _id: historicalLog._id })).toEqual({ ...historicalLog, cycle: '2026-fall', roundId: migratedRound._id });
    expect(await CaseGroupBackup.collection.findOne({ _id: historicalBackup._id })).toEqual({ ...historicalBackup, cycle: '2026-fall', roundId: migratedRound._id });
    expect(await getExistingStatus('2026-fall')).toMatchObject({ count: 1, emailsSent: 1, handEditsSinceBuild: 1 });
    expect(await CaseGroupEditLog.countDocuments({ action: 'migrate' })).toBe(1);
    expect(await migrateCaseGroups({ apply: true })).toEqual({ alreadyMigrated: true });
    expect(await CaseGroupBackup.countDocuments({ cycle: '2026-fall' })).toBe(2);
    expect(await Group.findById(other.group._id)).not.toBeNull();
    expect(await Evaluation.countDocuments({ cycle: '2027-winter' })).toBe(1);
  });

  test('migration refuses missing/cross-cycle applications before changing anything', async () => {
    const app = await applicant('2027-winter');
    await CaseGroupAssignment.create(assignment(app));
    await expect(migrateCaseGroups({ apply: true })).rejects.toThrow(/2026-fall/);
    expect(await Group.countDocuments()).toBe(0);
    expect(await CaseGroupBackup.countDocuments()).toBe(0);
    expect(await RecruitmentRound.countDocuments()).toBe(0);
  });

  test('database indexes reject duplicate rounds, rooms, membership and evaluations', async () => {
    const { app, round, group } = await gradedRound();
    await expect(RecruitmentRound.create({ cycle: round.cycle, kind: round.kind, name: 'Duplicate' })).rejects.toMatchObject({ code: 11000 });
    const room = { cycle: round.cycle, roundId: round._id, name: 'Room 1', timeSlot: 'A', capacity: 4 };
    await Room.create(room);
    await expect(Room.create(room)).rejects.toMatchObject({ code: 11000 });
    await expect(Group.create({ ...group.toObject(), _id: new mongoose.Types.ObjectId(), groupId: 'Tech-A-2', groupNumber: 2 })).rejects.toMatchObject({ code: 11000 });
    await expect(Evaluation.create({ cycle: round.cycle, roundId: round._id, groupId: group._id, applicationId: app._id, evaluator: 'grader@example.test', result: 'Fail' })).rejects.toMatchObject({ code: 11000 });
  });

  test('rebuilding stores a backup, edits preserve member identity and write logs, other cycles remain untouched', async () => {
    const first = await applicant(); const second = await applicant();
    const other = await gradedRound('case-night', '2027-winter');
    await replaceAssignments([assignment(first)], 'board@example.test', '2026-fall');
    const [old] = await listAssignments('2026-fall', false);
    await replaceAssignments([assignment(first), assignment(second, { groupNumber: 2, groupId: 'Tech-A-2' })], 'board@example.test', '2026-fall');
    expect((await CaseGroupBackup.find({ cycle: '2026-fall' }).sort({ replacedAt: -1 }).lean())[0].assignments[0]._id).toEqual(old._id);
    const rows = await listAssignments('2026-fall', false);
    const source = rows.find(row => String(row.applicationId) === String(second._id));
    await editAssignment({ cycle: '2026-fall', action: 'move', assignmentId: String(source._id), track: 'Tech', slot: 'A', groupNumber: 1, confirmWarnings: true, adminEmail: 'editor@example.test' });
    const moved = (await listAssignments('2026-fall', false)).find(row => String(row.applicationId) === String(second._id));
    expect(String(moved._id)).toBe(String(source._id));
    expect(moved.groupId).toBe('Tech-A-1');
    expect(await CaseGroupEditLog.countDocuments({ cycle: '2026-fall', action: 'move' })).toBe(1);
    await editAssignment({ cycle: '2026-fall', action: 'remove', assignmentId: String(moved._id), confirmWarnings: true, adminEmail: 'editor@example.test' });
    expect((await listAssignments('2026-fall', false)).length).toBe(1);
    expect(await Group.findById(other.group._id)).not.toBeNull();
  });

  test('hand edits require warning confirmation, preserve delivery metadata and roll back on logging failure', async () => {
    const first = await applicant(); const second = await applicant();
    await replaceAssignments([assignment(first, { emailSent: true, emailSentAt: new Date('2026-11-01T00:00:00Z'), notes: 'Preserve metadata' })], 'board@example.test', '2026-fall');
    const [source] = await listAssignments('2026-fall', false);
    const move = { cycle: '2026-fall', action: 'move', assignmentId: String(source._id), track: 'Tech', slot: 'B', groupNumber: 'new', adminEmail: 'editor@example.test' };
    await expect(editAssignment(move)).rejects.toMatchObject({ status: 409, warnings: expect.arrayContaining([expect.objectContaining({ code: 'emails-sent' })]) });
    expect((await listAssignments('2026-fall', false))[0].groupId).toBe('Tech-A-1');
    await editAssignment({ ...move, confirmWarnings: true });
    const [moved] = await listAssignments('2026-fall', false);
    expect(String(moved._id)).toBe(String(source._id));
    expect(moved).toMatchObject({ groupId: 'Tech-B-1', emailSent: true, notes: 'Preserve metadata', lastEditedBy: 'editor@example.test' });
    await editAssignment({ cycle: '2026-fall', action: 'add', applicationId: String(second._id), track: 'Tech', slot: 'B', groupNumber: 1, confirmWarnings: true, adminEmail: 'editor@example.test' });
    expect((await listAssignments('2026-fall', false))).toHaveLength(2);
    const before = await Group.find({ cycle: '2026-fall' }).lean();
    const backupCount = await CaseGroupBackup.countDocuments();
    jest.spyOn(CaseGroupEditLog, 'create').mockRejectedValue(new Error('Synthetic log write failure'));
    await expect(editAssignment({ cycle: '2026-fall', action: 'remove', assignmentId: String(moved._id), confirmWarnings: true, adminEmail: 'editor@example.test' })).rejects.toThrow('Synthetic log write failure');
    expect(await Group.find({ cycle: '2026-fall' }).lean()).toEqual(before);
    expect(await CaseGroupBackup.countDocuments()).toBe(backupCount);
  });

  test.each([['case-night', 'Final Interview - Yes'], ['final-interview', 'Accepted']])('finalizes %s atomically, records history and locks grades', async (kind, expectedStatus) => {
    const { app, round, decisions, preview } = await gradedRound(kind);
    expect(preview.blockers).toEqual([]);
    expect(await finalizeRound(round, decisions, preview.fingerprint, 'board@example.test')).toEqual({ finalized: true, updated: 1 });
    const updated = await Application.findById(app._id);
    expect(updated.status).toBe(expectedStatus);
    expect(updated.statusHistory).toHaveLength(1);
    expect(updated.statusHistory[0]).toMatchObject({ status: expectedStatus, changedBy: 'board@example.test' });
    expect((await RecruitmentRound.findById(round._id)).status).toBe('finalized');
    expect((await Evaluation.findOne({ roundId: round._id })).locked).toBe(true);
    expect(await CaseGroupEditLog.countDocuments({ action: 'finalize', roundId: round._id })).toBe(1);
    await expect(saveEvaluation(round, { applicationId: String(app._id), result: 'Fail' }, 'grader@example.test')).rejects.toMatchObject({ status: 409 });
    await expect(finalizeRound(round, decisions, preview.fingerprint, 'board@example.test')).rejects.toMatchObject({ status: 409 });
    expect((await Application.findById(app._id)).statusHistory).toHaveLength(1);
  });

  test('changed grades make a preview stale and keep the round editable', async () => {
    const { app, round, decisions, preview } = await gradedRound();
    await saveEvaluation(round, { applicationId: String(app._id), result: 'Fail', notes: 'Correction' }, 'grader@example.test');
    await expect(finalizeRound(round, decisions, preview.fingerprint, 'board@example.test')).rejects.toMatchObject({ status: 409 });
    expect((await Application.findById(app._id)).status).toBe('Case Night - Yes');
    expect((await Evaluation.findOne({ roundId: round._id })).locked).toBe(false);
  });

  test('failure after applicant writes rolls the entire transaction back', async () => {
    const { app, round, decisions, preview } = await gradedRound();
    const bulkWrite = Application.bulkWrite.bind(Application);
    jest.spyOn(Application, 'bulkWrite').mockImplementation(async (...args) => {
      await bulkWrite(...args);
      return { matchedCount: 0 };
    });
    await expect(finalizeRound(round, decisions, preview.fingerprint, 'board@example.test')).rejects.toMatchObject({ status: 409 });
    expect((await Application.findById(app._id)).status).toBe('Case Night - Yes');
    expect((await Application.findById(app._id)).statusHistory).toHaveLength(0);
    expect((await RecruitmentRound.findById(round._id)).status).toBe('draft');
    expect((await Evaluation.findOne({ roundId: round._id })).locked).toBe(false);
    expect(await CaseGroupEditLog.countDocuments({ action: 'finalize' })).toBe(0);
  });

  test('a concurrent grade correction and finalization cannot both commit against the old preview', async () => {
    const { app, round, decisions, preview } = await gradedRound();
    const outcomes = await Promise.allSettled([
      finalizeRound(round, decisions, preview.fingerprint, 'board@example.test'),
      saveEvaluation(round, { applicationId: String(app._id), result: 'Fail', notes: 'Concurrent correction' }, 'grader@example.test')
    ]);
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.find(result => result.status === 'rejected').reason.status).toBe(409);
    const finalRound = await RecruitmentRound.findById(round._id);
    const grade = await Evaluation.findOne({ roundId: round._id });
    if (finalRound.status === 'finalized') {
      expect(grade.locked).toBe(true);
      expect(grade.result).toBe('Pass');
      expect((await Application.findById(app._id)).statusHistory).toHaveLength(1);
    } else {
      expect(grade.locked).toBe(false);
      expect(grade.result).toBe('Fail');
      expect((await Application.findById(app._id)).statusHistory).toHaveLength(0);
    }
  });
});
