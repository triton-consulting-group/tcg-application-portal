// Returns a new list with `updated` merged into the matching application (by _id).
// Used after a status change so the dashboard doesn't re-download every application.
export const replaceApplication = (applications, updated) => {
  if (!updated || !updated._id) return applications;
  return applications.map((app) => (app._id === updated._id ? { ...app, ...updated } : app));
};
