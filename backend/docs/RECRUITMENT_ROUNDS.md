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

The existing `/api/case-groups` prefix has these round endpoints. All require a verified admin token. Finalization and evaluation writes currently require the existing super-admin role.

| Method and path | Request or result |
| --- | --- |
| `GET /round` | `{ round }`, or `null` when the round has not been created |
| `GET /round/finalization` | Round plus each applicant's current status and evaluations |
| `POST /round/finalization/preview` | `{ decisions: [{ applicationId, result: "Pass" or "Fail" }] }`; returns changes, blockers and a fingerprint |
| `POST /round/finalize` | The same decisions plus the preview fingerprint |
| `PUT /round/evaluations` | `{ applicationId, result, notes }`; evaluator comes from verified sign-in |

Each endpoint accepts `?cycle=2026-fall&kind=case-night` or `kind=final-interview`. Case-group build/edit endpoints remain specific to Case Night. Final Interview group setup and caser assignment are separate assigned tasks; finalization works when those records exist.

## Finalizing a round

The board selects Pass or Fail for every assigned applicant after reviewing the recorded evaluations. There is no inferred majority-vote rule. A split vote is shown for the board to resolve explicitly. Applicants without evaluations, missing applications and ineligible statuses block finalization.

Case Night decisions move applicants from `Case Night - Yes` to `Final Interview - Yes` or `Final Interview - No`. Final Interview decisions move applicants from `Final Interview - Yes` to `Accepted` or `Rejected`. The preview displays every transition before confirmation.

Finalization rechecks the preview in a transaction, records each application's status history, locks the evaluations, finalizes the round and writes an edit-log entry. A stale preview or concurrent status change aborts the whole transaction. Repeat finalization is rejected.

All group and evaluation writers must use `withRoundTransaction`. It updates the round's revision before writing, so grading, membership changes and finalization serialize on the same record. Grading code should call `saveEvaluation` from `services/roundFinalization.js`; direct collection writes bypass that protection. Dev 2's `canGrade` work can extend the existing permission check without changing this transaction boundary.

## Verification

Unit and route tests cover schema validation, group conversion, duplicate memberships, cycle boundaries, authentication, warning responses, preview decisions, stale previews, finalized-round locks and status-history writes. The separate replica-set integration suite exercises database transactions with synthetic applicants. No live applicant records are needed for these checks.
