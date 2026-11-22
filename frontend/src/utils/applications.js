// Returns a new list with `updated` merged into the matching application (by _id).
// Used after a status change so the dashboard doesn't re-download every application.
export const replaceApplication = (applications, updated) => {
  if (!updated || !updated._id) return applications;
  return applications.map((app) => (app._id === updated._id ? { ...app, ...updated } : app));
};

// Formats a stored E.164 phone number for reading: "(858) 555-0123" for US numbers,
// the stored "+…" value otherwise, and "Not provided" for applications from before phones were collected.
export const formatPhone = (phoneNumber) => {
  if (!phoneNumber) return "Not provided";
  const us = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(phoneNumber);
  return us ? `(${us[1]}) ${us[2]}-${us[3]}` : phoneNumber;
};
