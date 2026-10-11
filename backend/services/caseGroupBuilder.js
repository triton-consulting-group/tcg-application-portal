const crypto = require("crypto");
const { parseCaseNightPreferences } = require("../utils/caseNightPreferences");

// Only applicants with this status are placed in case groups
const ELIGIBLE_STATUS = "Case Night - Yes";

// Build order matters: Non-Tech goes first, so it gets first claim on each slot's capacity
const TRACKS = ["Non-Tech", "Tech"];

// A slot can hold n people only if n splits into groups of 4 and 3 (so not 1, 2 or 5)
const isGroupableSize = (n) => Number.isInteger(n) && (n === 0 || n === 3 || n === 4 || n >= 6);

// Fewest groups of 3 needed to split n people, by n mod 4
const threesNeeded = (n) => [0, 3, 2, 1][n % 4];

// Group sizes for n people: as many 4s as possible, 3s only to cover the remainder
const splitIntoGroups = (n) => {
  if (!isGroupableSize(n)) {
    throw new Error(`${n} people can't be split into groups of 3 and 4`);
  }
  const threes = threesNeeded(n);
  const fours = (n - 3 * threes) / 4;
  return [...Array(fours).fill(4), ...Array(threes).fill(3)];
};

const makeGroupId = (track, slot, groupNumber) => `${track}-${slot}-${groupNumber}`;

const byCreated = (a, b) => a.createdAt - b.createdAt || a.applicationId.localeCompare(b.applicationId);

// Least flexible first, then earliest submission
const byPriority = (a, b) => a.prefs.length - b.prefs.length || byCreated(a, b);

const publicFields = ({ applicationId, fullName, email }) => ({ applicationId, fullName, email });

const groupsAllowedPerSlot = (config, slotKeys) =>
  Object.fromEntries(
    slotKeys.map((slot) => [
      slot,
      typeof config.maxGroupsPerSlot === "number" ? config.maxGroupsPerSlot : config.maxGroupsPerSlot[slot],
    ])
  );

// Picks how many people go in each slot. Tries every split, keeping only ones that
// (a) people's availability allows (Hall's condition), (b) split into groups of 3-4,
// and (c) fit the remaining capacity. Preference: most placed, fewest groups of 3,
// smallest gap between slots, then the lexicographically smallest split.
const chooseSlotCounts = (candidates, slotKeys, groupsLeft) => {
  const K = slotKeys.length;
  const prefMasks = candidates.map((c) =>
    c.prefs.reduce((mask, slot) => mask | (1 << slotKeys.indexOf(slot)), 0)
  );

  // reach[mask] = how many candidates can make at least one slot in mask
  const reach = new Array(1 << K).fill(0);
  for (let mask = 1; mask < 1 << K; mask++) {
    reach[mask] = prefMasks.filter((p) => p & mask).length;
  }

  const fits = (counts) => {
    for (let mask = 1; mask < 1 << K; mask++) {
      let sum = 0;
      for (let i = 0; i < K; i++) if (mask & (1 << i)) sum += counts[i];
      if (sum > reach[mask]) return false;
    }
    return counts.every((n, i) => splitIntoGroups(n).length <= groupsLeft[slotKeys[i]]);
  };

  const score = (counts) => [
    counts.reduce((total, n) => total + threesNeeded(n), 0),
    Math.max(...counts) - Math.min(...counts),
    ...counts,
  ];

  const isBetter = (a, b) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
    return false;
  };

  // Groups hold at most 4, so never try to place more people than the remaining capacity holds
  const maxTotal = Math.min(candidates.length, slotKeys.reduce((sum, slot) => sum + groupsLeft[slot] * 4, 0));
  for (let total = maxTotal; total >= 0; total--) {
    let best = null;
    let bestScore = null;
    const counts = new Array(K).fill(0);

    const visit = (i, remaining) => {
      const limit = Math.min(remaining, reach[1 << i]);
      if (i === K - 1) {
        if (remaining > limit || !isGroupableSize(remaining)) return;
        counts[i] = remaining;
        if (!fits(counts)) return;
        const candidateScore = score(counts);
        if (!best || isBetter(candidateScore, bestScore)) {
          best = [...counts];
          bestScore = candidateScore;
        }
        return;
      }
      for (let n = 0; n <= limit; n++) {
        if (!isGroupableSize(n)) continue;
        counts[i] = n;
        visit(i + 1, remaining - n);
      }
    };

    visit(0, total);
    if (best) return Object.fromEntries(slotKeys.map((slot, i) => [slot, best[i]]));
  }
  return Object.fromEntries(slotKeys.map((slot) => [slot, 0]));
};

// Places candidates (already in priority order) into slots so each slot gets exactly
// counts[slot] people, using augmenting paths (bipartite matching). Anyone who can't
// be placed is returned in `unplaced`.
const assignToSlots = (candidates, slotKeys, counts) => {
  const members = Object.fromEntries(slotKeys.map((slot) => [slot, []]));

  const tryPlace = (candidate, seen) => {
    for (const slot of candidate.prefs) {
      if (seen.has(slot)) continue;
      seen.add(slot);
      if (members[slot].length < counts[slot]) {
        members[slot].push(candidate);
        return true;
      }
      for (const other of members[slot]) {
        if (tryPlace(other, seen)) {
          members[slot] = members[slot].filter((m) => m !== other);
          members[slot].push(candidate);
          return true;
        }
      }
    }
    return false;
  };

  const unplaced = candidates.filter((candidate) => !tryPlace(candidate, new Set()));
  return { members, unplaced };
};

const buildCaseGroupPlan = (applications, config) => {
  const slotKeys = Object.keys(config.slots).sort();
  const excluded = [];
  const candidatesByTrack = Object.fromEntries(TRACKS.map((track) => [track, []]));
  let eligible = 0;

  for (const app of applications) {
    if (app.status !== ELIGIBLE_STATUS) continue;
    eligible++;

    const person = {
      applicationId: String(app._id),
      fullName: app.fullName,
      email: app.email,
      createdAt: new Date(app.createdAt || 0).getTime(),
    };

    if (!TRACKS.includes(app.candidateType)) {
      excluded.push({ ...publicFields(person), candidateType: app.candidateType, reason: "No track" });
      continue;
    }

    const prefs = parseCaseNightPreferences(app.caseNightPreferences)
      .filter((slot) => slotKeys.includes(slot))
      .sort();
    if (prefs.length === 0) {
      excluded.push({ ...publicFields(person), candidateType: app.candidateType, reason: "No case night availability" });
      continue;
    }

    candidatesByTrack[app.candidateType].push({ ...person, prefs });
  }

  const groupsLeft = groupsAllowedPerSlot(config, slotKeys);
  const tracks = {};
  let placed = 0;

  for (const track of TRACKS) {
    const candidates = candidatesByTrack[track].sort(byPriority);
    const counts = chooseSlotCounts(candidates, slotKeys, groupsLeft);
    const { members, unplaced } = assignToSlots(candidates, slotKeys, counts);

    for (const person of unplaced) {
      excluded.push({
        ...publicFields(person),
        candidateType: track,
        reason: "Could not be placed in a group of 3–4 with their availability",
      });
    }

    const slots = {};
    let groupsOf4 = 0;
    let groupsOf3 = 0;

    for (const slot of slotKeys) {
      const people = members[slot].sort(byCreated);
      const sizes = splitIntoGroups(people.length);
      let start = 0;

      slots[slot] = {
        label: config.slots[slot],
        count: people.length,
        groups: sizes.map((size, i) => {
          const group = {
            groupNumber: i + 1,
            groupId: makeGroupId(track, slot, i + 1),
            members: people.slice(start, start + size).map(publicFields),
          };
          start += size;
          return group;
        }),
      };

      groupsLeft[slot] -= sizes.length;
      groupsOf4 += sizes.filter((size) => size === 4).length;
      groupsOf3 += sizes.filter((size) => size === 3).length;
    }

    const trackPlaced = candidates.length - unplaced.length;
    placed += trackPlaced;
    tracks[track] = { placed: trackPlaced, groupsOf4, groupsOf3, slots };
  }

  excluded.sort((a, b) => a.applicationId.localeCompare(b.applicationId));

  return { tracks, excluded, summary: { eligible, placed, excluded: excluded.length } };
};

// Every group placement in a plan, as flat rows
const planRows = (plan) =>
  Object.entries(plan.tracks).flatMap(([track, { slots }]) =>
    Object.entries(slots).flatMap(([slot, { groups }]) =>
      groups.flatMap((group) => group.members.map((member) => ({ track, slot, group, member })))
    )
  );

// Short hash of who goes in which group; the build route uses it to refuse a plan the admin didn't preview
const planFingerprint = (plan) => {
  const rows = planRows(plan)
    .map(({ track, slot, group, member }) => `${track}|${slot}|${group.groupNumber}|${member.applicationId}`)
    .sort();
  return crypto.createHash("sha256").update(rows.join("\n")).digest("hex");
};

// CaseGroupAssignment documents for a plan
const toAssignmentDocs = (plan, config, adminEmail) =>
  planRows(plan).map(({ track, slot, group, member }) => ({
    applicationId: member.applicationId,
    applicantName: member.fullName,
    applicantEmail: member.email,
    candidateType: track,
    timeSlot: slot,
    timeSlotDisplay: config.slots[slot],
    groupNumber: group.groupNumber,
    groupId: group.groupId,
    assignedBy: adminEmail,
    status: "Assigned",
  }));

module.exports = {
  ELIGIBLE_STATUS,
  TRACKS,
  isGroupableSize,
  splitIntoGroups,
  makeGroupId,
  buildCaseGroupPlan,
  planFingerprint,
  toAssignmentDocs,
};
