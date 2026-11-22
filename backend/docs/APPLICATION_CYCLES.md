# Application cycles

`ACTIVE_RECRUITMENT_CYCLE` selects the cycle applicants can submit, view and edit. It defaults to `2026-fall`. Use a lowercase slug such as `2027-winter`. The server ignores cycle fields supplied by applicants. An email can submit once in each cycle.

Admins select a cycle in the Associate Portal. Application lists, details, changes, comments and exports stay within that selection. `/api/applications/cycles` returns the active cycle and cycles with stored applications. The existing file endpoint continues to authorize ownership, including files belonging to an applicant's earlier applications.

## Existing database migration

Run this before starting the new code against an existing database. Stop portal writes during migration and keep a database backup. Use the same database connection as the portal (`MONGO_URI`).

```
node scripts/migrateApplicationCycles.js
node scripts/migrateApplicationCycles.js --apply
```

The first command only checks and reports. The second stores unchanged originals in `application_cycle_backups`, assigns missing cycles to `2026-fall`, normalizes emails, builds and verifies the unique cycle/email index, then drops only the old email-only unique index. Other application fields and IDs stay unchanged. Duplicate cycle/email pairs or invalid records stop the migration for manual resolution. Retrying is safe; the first backup of each changed application is retained.

Confirm the migration completes before setting a new active cycle and reopening the portal. Keep `application_cycle_backups` private under the same access controls and retention rules as applications. This implementation has not run against production.

For rollback, stop writes and restore the database backup before deploying the old application code. Do not recreate the old email-only index after accepting applications in multiple cycles: repeat applicants legitimately have more than one record.

The supported `deleteApplication.js`, `deleteDuplicateApplications.js` and `exportAllApplicants.js` maintenance commands also use `ACTIVE_RECRUITMENT_CYCLE`. Set it explicitly when operating on a historical cycle. Duplicate cleanup never groups records from different cycles.
