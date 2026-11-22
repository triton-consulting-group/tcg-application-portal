# Recruitment rounds

Applications belong to a cycle. Each cycle has a Case Night round and can have a Final Interview round. A round owns rooms, groups and evaluations. Groups contain applicant memberships; membership IDs stay stable when someone moves. Existing board endpoints still return flattened memberships for the case-group board.

The new collections are `recruitmentrounds`, `rooms`, `groups` and `evaluations`. Their indexes are declared on the models and created during startup. Rooms and groups reference the round and carry its cycle. Evaluations reference the round, group and application, with one result per evaluator per applicant per round.

## Migration

Run the application-cycle migration before the case-group migration. Pause writes during migration and keep the deployment's database snapshot. Use a replica set; the migration and group changes require transactions and refuse standalone MongoDB writes.

From `backend`, with `MONGO_URI` pointing to the database being migrated:

```sh
node scripts/migrateCaseGroups.js
node scripts/migrateCaseGroups.js --apply
```

The first command validates and reports counts without changing records. The second validates every legacy membership and its application, stores a full backup, creates normalized groups in the `2026-fall` Case Night round, and records a migration log in one transaction. Duplicate applicants, invalid memberships, missing applications or an existing populated destination abort the migration. The original `casegroupassignments` collection remains intact. Historical backups and edit logs receive the legacy cycle and round reference without changing their contents, so the board still counts and retrieves them. A repeat run returns `alreadyMigrated` without duplicating data.

Do not run the old application against this database after new groups have been edited: it reads the retained legacy collection. For a rollback after edits, stop writes and restore the database snapshot with the previous application version. Group rebuild backups include both flattened memberships and full group records, including room links and notes.

## Board and API

The board sends its selected cycle with every request. Case-group reads, builds, edits and exports use `Group`, scoped to the cycle's Case Night round. Rebuilds back up the current groups and record an edit log. Hand edits preserve the warning confirmations for unavailable slots, track changes, small groups and sent emails. The transaction rechecks membership and eligibility. A graded applicant cannot move groups; a graded round cannot be rebuilt.
