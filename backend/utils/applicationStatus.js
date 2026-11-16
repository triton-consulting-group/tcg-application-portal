// Once the board decides on an application, the applicant can no longer edit it.
// The view page locks its Edit button on the same list (frontend/src/utils/applications.js).
const LOCKED_STATUSES = ["Accepted", "Rejected", "Final Interview - Yes"];

const isApplicationLocked = (status) => LOCKED_STATUSES.includes(status);

module.exports = { LOCKED_STATUSES, isApplicationLocked };
