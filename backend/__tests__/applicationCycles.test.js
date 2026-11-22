const mockVerifyIdToken = jest.fn();
const mockSave = jest.fn();
jest.mock('../config/firebaseAdmin', () => ({ getFirebaseAuth: () => ({ verifyIdToken: mockVerifyIdToken }) }));
jest.mock('../config/deadlineConfig', () => ({ isActive: false }));
jest.mock('../models/Admin', () => ({ findOne: jest.fn() }));
jest.mock('../models/Application', () => {
  const Model = jest.fn(function (fields) { Object.assign(this, fields); this.save = mockSave; });
  for (const name of ['find', 'findOne', 'findOneAndUpdate', 'countDocuments', 'distinct']) Model[name] = jest.fn();
  return Model;
});
jest.mock('../config/s3Config', () => ({ s3: {}, S3_CONFIG: { uploadSettings: { maxFileSize: 1024, allowedMimeTypes: [] } }, isS3Configured: () => false }));
const express = require('express');
const Application = require('../models/Application');
const Admin = require('../models/Admin');
const routes = require('../routes/applications');
let server, base;
const id = '64b000000000000000000001';
const email = 'applicant@ucsd.edu';
beforeAll(done => {
  const app = express(); app.use(express.json()); app.use(routes);
  server = app.listen(0, '127.0.0.1', () => { base = `http://127.0.0.1:${server.address().port}`; done(); });
});
afterAll(done => { server.close(done); });
beforeEach(() => {
  jest.clearAllMocks();
  process.env.ACTIVE_RECRUITMENT_CYCLE = '2027-winter';
  mockVerifyIdToken.mockResolvedValue({ email, email_verified: true });
  Admin.findOne.mockResolvedValue({ email, role: 'super_admin' });
  Application.findOne.mockResolvedValue({ _id: id, cycle: '2027-winter', email });
  Application.findOneAndUpdate.mockResolvedValue({ _id: id, comments: [] });
  const chain = { sort: () => chain, skip: () => chain, limit: () => chain, lean: async () => [] };
  Application.find.mockReturnValue(chain);
  Application.countDocuments.mockResolvedValue(0);
  Application.distinct.mockResolvedValue(['2026-fall']);
  mockSave.mockResolvedValue();
});
afterEach(() => { delete process.env.ACTIVE_RECRUITMENT_CYCLE; });
const request = (path, method = 'GET', body) => fetch(base + path, {
  method, headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body)
});
test('applicant submission owns its cycle and ignores body/query overrides', async () => {
  const res = await request('/?cycle=2026-fall', 'POST', { cycle: '2026-fall', fullName: 'Test', phoneNumber: '8585550123', studentYear: '2nd', major: 'Economics', appliedBefore: 'No', candidateType: 'Tech', reason: 'Test' });
  expect(res.status).toBe(201);
  expect(Application).toHaveBeenCalledWith(expect.objectContaining({ cycle: '2027-winter', email }));
});
test('applicant lookup and edit stay in active cycle despite overrides', async () => {
  expect((await request(`/email/${email}?cycle=2026-fall`)).status).toBe(200);
  expect(Application.findOne).toHaveBeenLastCalledWith({ cycle: '2027-winter', email });
  expect((await request(`/email/${email}?cycle=2026-fall`, 'PUT', { cycle: '2026-fall', fullName: 'Changed' })).status).toBe(200);
  expect(Application.findOneAndUpdate.mock.calls[0][0]).toEqual({ cycle: '2027-winter', email });
  expect(Application.findOneAndUpdate.mock.calls[0][1]).not.toHaveProperty('cycle');
});
test.each(['/all', '/', '/export-by-status?statuses=Under%20Review'])('board list/export scopes selected cycle: %s', async path => {
  await request(path + (path.includes('?') ? '&' : '?') + 'cycle=2026-fall');
  expect(Application.find.mock.calls[0][0]).toMatchObject({ cycle: '2026-fall' });
});
test('pagination counts only selected cycle', async () => {
  await request('/?cycle=2026-fall');
  expect(Application.countDocuments).toHaveBeenCalledWith({ cycle: '2026-fall' });
});
test.each(['/all?cycle[$ne]=x', '/all?cycle=a&cycle=b', '/all?cycle=BAD'])('rejects malformed cycle before querying: %s', async path => {
  expect((await request(path)).status).toBe(400);
  expect(Application.find).not.toHaveBeenCalled();
});
test('details and status/comment writes cannot reach an ID in a different cycle', async () => {
  Application.findOne.mockResolvedValue(null);
  for (const [method, path, body] of [['GET', `/${id}`], ['PUT', `/${id}`, { status: 'Accepted' }], ['POST', `/${id}/comment`, { comment: 'test' }]]) {
    expect((await request(path + '?cycle=2026-fall', method, body)).status).toBe(404);
    expect(Application.findOne).toHaveBeenLastCalledWith({ _id: id, cycle: '2026-fall' });
  }
  expect(Application.findOneAndUpdate).not.toHaveBeenCalled();
});
test('comment deletion filters both application and cycle', async () => {
  expect((await request(`/${id}/comments/64b000000000000000000002?cycle=2026-fall`, 'DELETE')).status).toBe(200);
  expect(Application.findOneAndUpdate.mock.calls[0][0]).toMatchObject({ _id: id, cycle: '2026-fall' });
});
test('cycle discovery lists active cycle even without applications', async () => {
  const res = await request('/cycles');
  expect(await res.json()).toEqual({ activeCycle: '2027-winter', cycles: ['2027-winter', '2026-fall'] });
});
