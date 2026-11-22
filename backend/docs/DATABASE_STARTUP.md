# Database startup

The server starts listening only after MongoDB connects, the migration checks pass, and every registered model's indexes are created. A failed index build stops startup, because accepting writes without uniqueness constraints can produce duplicate applications or group memberships.

This extends Humza's automatic-index work in PR #76 with the four recruitment models and fail-closed startup. Index creation is idempotent and never drops indexes. The cycle migration is the only code that removes the old email-only unique index, after verifying its replacement.

Before upgrading an existing database:

1. Stop portal writes and take a database backup.
2. Run the application-cycle migration's dry run, then apply it. See `APPLICATION_CYCLES.md`.
3. Run the case-group migration's dry run, then apply it. Keep the legacy collection and migration backups.
4. Start the server and verify its health endpoint and the board's cycle selector.

Round changes require a MongoDB replica set or Atlas deployment for transactions. A standalone MongoDB server can serve reads but cannot safely commit round edits or finalization.

If startup reports an index error, resolve the conflicting records under the board's data policy and restart. Do not disable uniqueness or delete records just to start the service.
