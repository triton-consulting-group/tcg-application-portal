export const TRACKS = ["Non-Tech", "Tech"];

const readBlobText = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });

// The server's error message from an axios error, or `fallback`.
// Handles blob responses too (the CSV export asks for a blob, so its error body arrives as one).
export const getErrorMessage = async (error, fallback) => {
  const data = error?.response?.data;
  if (!data) return fallback;
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    try {
      return JSON.parse(await readBlobText(data)).error || fallback;
    } catch {
      return fallback;
    }
  }
  return data.error || fallback;
};

// Case night preferences as a clean list; older applications saved them comma-joined (["A,B,C"])
export const parsePrefs = (raw) => [
  ...new Set(
    (Array.isArray(raw) ? raw : [raw])
      .flatMap((value) => (typeof value === "string" ? value.split(",") : []))
      .map((slot) => slot.trim())
      .filter(Boolean)
  )
];

const byName = (a, b) => a.name.localeCompare(b.name);

const emptyBoard = (slotKeys) =>
  Object.fromEntries(
    TRACKS.map((track) => [track, { slots: Object.fromEntries(slotKeys.map((slot) => [slot, []])), unassigned: [] }])
  );

// Unassigned people go in their own track's tray; anyone without a valid track shows in both
const addToTrays = (board, person, track) => {
  for (const t of TRACKS.includes(track) ? [track] : TRACKS) board[t].unassigned.push(person);
};

const sortBoard = (board) => {
  for (const { slots, unassigned } of Object.values(board)) {
    for (const groups of Object.values(slots)) {
      groups.sort((a, b) => a.groupNumber - b.groupNumber);
      groups.forEach((g) => g.members.sort(byName));
    }
    unassigned.sort(byName);
  }
  return board;
};

// Board for the Case Groups window: track → { slots: slot → groups, unassigned: people }.
// `assignments` come from GET /assignments (application populated), `unassigned` from GET /unassigned.
export const boardFromAssignments = (assignments, unassigned, slotKeys) => {
  const board = emptyBoard(slotKeys);

  for (const a of assignments) {
    const groups = board[a.candidateType]?.slots[a.timeSlot];
    if (!groups) continue;
    let group = groups.find((g) => g.groupNumber === a.groupNumber);
    if (!group) {
      group = { groupNumber: a.groupNumber, groupId: a.groupId, members: [] };
      groups.push(group);
    }
    const application = a.applicationId && typeof a.applicationId === "object" ? a.applicationId : null;
    group.members.push({
      id: a._id,
      assignmentId: a._id,
      applicationId: application?._id ?? null,
      name: a.applicantName,
      track: application?.candidateType ?? null,
      prefs: application ? parsePrefs(application.caseNightPreferences) : null,
      emailSent: Boolean(a.emailSent),
      reason: null,
      year: application?.studentYear || null
    });
  }

  for (const u of unassigned) {
    addToTrays(
      board,
      {
        id: u._id,
        assignmentId: null,
        applicationId: u._id,
        name: u.fullName,
        track: u.candidateType,
        prefs: parsePrefs(u.caseNightPreferences),
        emailSent: false,
        reason: null,
        year: u.studentYear || null
      },
      u.candidateType
    );
  }

  return sortBoard(board);
};

// Board for the Build preview: the proposed groups, with anyone not placed in the tray (and why)
export const boardFromPlan = (plan) => {
  const slotKeys = Object.keys(Object.values(plan.tracks)[0]?.slots || {});
  const board = emptyBoard(slotKeys);
  const person = (m, reason = null) => ({
    id: m.applicationId,
    assignmentId: null,
    applicationId: m.applicationId,
    name: m.fullName,
    track: m.candidateType ?? null,
    prefs: null,
    emailSent: false,
    reason,
    year: m.studentYear || null
  });

  for (const track of TRACKS) {
    for (const [slot, { groups }] of Object.entries(plan.tracks[track]?.slots || {})) {
      board[track].slots[slot] = groups.map((g) => ({
        groupNumber: g.groupNumber,
        groupId: g.groupId,
        members: g.members.map((m) => person(m))
      }));
    }
  }
  for (const e of plan.excluded) addToTrays(board, person(e, e.reason), e.candidateType);

  // Keep the builder's order for groups; only sort names
  for (const { slots } of Object.values(board)) {
    for (const groups of Object.values(slots)) groups.forEach((g) => g.members.sort(byName));
  }
  return board;
};

// Why a person stands out in a group (shown in orange), or null if they fit
export const mismatchReason = (person, slot, groupTrack, slotLabels) => {
  if (person.prefs && !person.prefs.includes(slot)) return `Didn't pick ${slotLabels[slot] || slot}`;
  if (person.track && person.track !== groupTrack) return `${person.name} is ${person.track}`;
  return null;
};

// Everyone whose name contains the query, in board order: tracks, then slots and groups, then the tray
export const searchMatches = (board, query) => {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return TRACKS.flatMap((track) => {
    const { slots, unassigned } = board[track];
    const people = [...Object.values(slots).flatMap((groups) => groups.flatMap((g) => g.members)), ...unassigned];
    return people.filter((p) => p.name.toLowerCase().includes(q)).map((p) => ({ id: p.id, track }));
  });
};

// Colour band for a group's size badge
export const sizeTone = (n) => (n < 3 ? "small" : n === 3 ? "three" : n === 4 ? "four" : "big");
