# Portal settings

The super-admin screen is `/admin/settings`. Authenticated ordinary admins,
including admins with management permission, cannot read or write the protected
settings API. Applicant-facing values are available from `/api/settings/public`.

Settings are stored in one `portalsettings` document (`_id: portal`). Until the
first save, the existing deadline and Case Night configuration and original form
wording supply defaults. A database read failure returns an error, rather than
silently reopening applications using defaults. Each request reads one snapshot.
Saving uses a revision check; a stale editor receives 409 and must reload.

Application times require ISO date/time strings with an explicit offset or Z.
The editor displays Pacific time for confirmation. Opening must precede closing.
The window toggle retains its existing meaning: disabling it disables date gating.
Question wording is plain text; required fields and answer limits are unchanged.

Slot IDs A/B/C remain fixed because applications and assignments reference them.
Labels and maximum groups per slot (per candidate track) are configurable. The
scheduler still uses groups of three/four; this feature does not change that
algorithm. Existing assignments retain their saved time labels and are not rebuilt
when settings change. Review existing assignments before changing published slot
times or reducing capacities. A settings change invalidates an outstanding build
preview. The assignment CLI also reads the saved settings.

## Merge sequence

Merge after PR #107 (recruitment-cycle scoping). Rebase and rerun integration tests
against that PR before merging. This implementation works against current main
and does not introduce or change cycle IDs, cycle filters, or migrations. Its
cycle name is only a display name, and settings are portal-wide, not historical
per-cycle settings. Preserve #107's application scoping when integrating changes
to applications.js and the Associate Portal navigation.

Also preserve the navigation changes in admin-management PR #119 and dashboard
refactor PR #120 if those merge first. This branch does not include those PRs.

## Checks

- Backend: `npm test -- --runInBand --testTimeout=30000`.
- Frontend: `npm test -- --watchAll=false --runInBand PortalSettingsPage.test.js`.
- Production build: `npm run build` in frontend.
- Standalone MongoDB integration: install the existing loadtest dependencies, then
  run `node loadtest/test-portal-settings.js` from the repository root. This starts
  and removes an isolated test MongoDB server. Optionally set
  `MONGOMS_SYSTEM_BINARY` and `MONGOMS_VERSION` to use an installed binary.
  These tests are skipped by the ordinary backend command and run separately.
- Manually test super-admin access, ordinary-admin denial, save/reload, stale
  editor conflicts, cancel, dates on both sides of the application window, form
  wording, slot configuration and a fresh Case Night preview.
- Verify real Firebase sign-in in a preview deployment before merging.

No environment variables or database migrations are required for settings.
