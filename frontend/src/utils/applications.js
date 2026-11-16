// Once the board decides on an application, the applicant can no longer edit it.
// The server refuses edits on the same list (backend/utils/applicationStatus.js).
export const LOCKED_STATUSES = ["Accepted", "Rejected", "Final Interview - Yes"];

export const isApplicationLocked = (status) => LOCKED_STATUSES.includes(status);

// Returns a new list with `updated` merged into the matching application (by _id).
// Used after a status change so the dashboard doesn't re-download every application.
export const replaceApplication = (applications, updated) => {
  if (!updated || !updated._id) return applications;
  return applications.map((app) => (app._id === updated._id ? { ...app, ...updated } : app));
};
