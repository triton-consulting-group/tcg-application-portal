import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import AssociatePage from './AssociatePage';
jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() } }));
jest.mock('firebase/auth', () => ({ onAuthStateChanged: (_, callback) => { callback({ email: 'board@ucsd.edu' }); return () => {}; } }));
jest.mock('./Home/firebaseConfig', () => ({ auth: {} }));
jest.mock('../config/adminAuth', () => ({ getAdminAuthHeaders: async () => ({ Authorization: 'Bearer test' }) }));
jest.mock('./ApplicationComponents/BuildCaseGroupsModal', () => () => null);
jest.mock('./ApplicationComponents/CaseGroupsModal', () => () => null);
jest.mock('./ApplicationComponents/RoundFinalizationModal', () => () => null);
beforeEach(() => {
  jest.clearAllMocks();
  axios.post.mockResolvedValue({ data: { isAdmin: true, admin: { role: 'super_admin', name: 'Test Admin', permissions: {} } } });
  axios.get.mockImplementation(async (url, options) => {
    if (url.endsWith('/cycles')) return { data: { activeCycle: '2027-winter', cycles: ['2027-winter', '2026-fall'] } };
    if (url.endsWith('/all')) return { data: [{ _id: '1', cycle: options.params.cycle, fullName: options.params.cycle === '2027-winter' ? 'Winter Applicant' : 'Fall Applicant', email: 'synthetic@ucsd.edu', status: 'Under Review', reason: 'Synthetic reason', major: 'Economics', studentYear: '2nd', candidateType: 'Tech', appliedBefore: 'No' }] };
    return { data: {} };
  });
});
test('starts on the server active cycle and switches the board list to a historical cycle', async () => {
  render(<AssociatePage />);
  expect(await screen.findByText('Winter Applicant')).toBeInTheDocument();
  expect(screen.getByLabelText('Recruitment cycle')).toHaveValue('2027-winter');
  fireEvent.change(screen.getByLabelText('Recruitment cycle'), { target: { value: '2026-fall' } });
  expect(await screen.findByText('Fall Applicant')).toBeInTheDocument();
  expect(screen.queryByText('Winter Applicant')).not.toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/all$/), expect.objectContaining({ params: { cycle: '2026-fall' } }));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh Data' }));
  await waitFor(() => expect(screen.getByText('Fall Applicant')).toBeInTheDocument());
  expect(axios.get.mock.calls.at(-1)[1].params.cycle).toBe('2026-fall');
});
