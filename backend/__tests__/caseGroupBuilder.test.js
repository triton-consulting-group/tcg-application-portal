const {
  isGroupableSize,
  splitIntoGroups,
  makeGroupId,
  buildCaseGroupPlan,
  planFingerprint,
  toAssignmentDocs,
} = require("../services/caseGroupBuilder");

const config = {
  slots: { A: "6:00 PM – 7:00 PM", B: "7:00 PM – 8:00 PM", C: "8:00 PM – 9:00 PM" },
  groupSize: 4,
  maxGroupsPerSlot: { A: 50, B: 50, C: 50 },
};

let nextId = 0;
// Builds a fake "Case Night - Yes" application; ids and submission times increase with each call
const app = (candidateType, caseNightPreferences, overrides = {}) => {
  nextId++;
  return {
    _id: `app${String(nextId).padStart(4, "0")}`,
    fullName: `Person ${nextId}`,
    email: `p${nextId}@ucsd.edu`,
    candidateType,
    caseNightPreferences,
    status: "Case Night - Yes",
    createdAt: new Date(2026, 0, 1, 0, nextId),
    ...overrides,
  };
};
const many = (count, candidateType, prefs) => Array.from({ length: count }, () => app(candidateType, prefs));

// Every member in a track's plan, with the slot and group they were put in
const placements = (plan, track) =>
  Object.entries(plan.tracks[track].slots).flatMap(([slot, { groups }]) =>
    groups.flatMap((group) => group.members.map((member) => ({ slot, group, member })))
  );
const groupSizes = (plan, track) =>
  Object.values(plan.tracks[track].slots).flatMap(({ groups }) => groups.map((g) => g.members.length));

beforeEach(() => {
  nextId = 0;
});

describe("splitIntoGroups", () => {
  test.each([
    [12, [4, 4, 4]],
    [11, [4, 4, 3]],
    [10, [4, 3, 3]],
    [9, [3, 3, 3]],
    [8, [4, 4]],
    [7, [4, 3]],
    [6, [3, 3]],
    [4, [4]],
    [3, [3]],
    [0, []],
  ])("%p people → %p", (n, expected) => {
    expect(splitIntoGroups(n)).toEqual(expected);
  });

  test.each([1, 2, 5])("%p people can't be grouped", (n) => {
    expect(isGroupableSize(n)).toBe(false);
    expect(() => splitIntoGroups(n)).toThrow();
  });
});

test("makeGroupId includes track, slot and number", () => {
  expect(makeGroupId("Tech", "A", 2)).toBe("Tech-A-2");
});

describe("buildCaseGroupPlan", () => {
  test("only Case Night - Yes applicants are considered", () => {
    const apps = [...many(4, "Tech", ["A"]), app("Tech", ["A"], { status: "Under Review" })];
    const plan = buildCaseGroupPlan(apps, config);
    expect(plan.summary.eligible).toBe(4);
    expect(placements(plan, "Tech")).toHaveLength(4);
  });

  test("never mixes tracks in a group", () => {
    const apps = [...many(4, "Tech", ["A"]), ...many(4, "Non-Tech", ["A"])];
    const plan = buildCaseGroupPlan(apps, config);
    const techIds = new Set(apps.filter((a) => a.candidateType === "Tech").map((a) => a._id));
    for (const { member } of placements(plan, "Tech")) expect(techIds.has(member.applicationId)).toBe(true);
    for (const { member } of placements(plan, "Non-Tech")) expect(techIds.has(member.applicationId)).toBe(false);
  });

  test("nobody is placed in a slot they didn't pick", () => {
    const apps = [...many(5, "Tech", ["A"]), ...many(5, "Tech", ["B", "C"]), ...many(7, "Tech", ["A", "C"])];
    const plan = buildCaseGroupPlan(apps, config);
    const prefsById = Object.fromEntries(apps.map((a) => [a._id, a.caseNightPreferences]));
    for (const { slot, member } of placements(plan, "Tech")) {
      expect(prefsById[member.applicationId]).toContain(slot);
    }
    expect(plan.excluded).toEqual([]);
  });

  test("groups are always 3 or 4, preferring 4", () => {
    const plan = buildCaseGroupPlan(many(24, "Non-Tech", ["A", "B", "C"]), config);
    expect(groupSizes(plan, "Non-Tech").sort()).toEqual([4, 4, 4, 4, 4, 4]);
    expect(plan.tracks["Non-Tech"].groupsOf3).toBe(0);
  });

  test("prefers fewer groups of 3 over even slots", () => {
    // 24 flexible people: 8/8/8 (all 4s) beats anything with groups of 3
    const plan = buildCaseGroupPlan(many(24, "Tech", ["A", "B", "C"]), config);
    const counts = Object.values(plan.tracks.Tech.slots).map((s) => s.count);
    expect(counts).toEqual([8, 8, 8]);
  });

  test("uses groups of 3 only to cover the remainder", () => {
    const plan = buildCaseGroupPlan(many(11, "Tech", ["A"]), config);
    expect(groupSizes(plan, "Tech")).toEqual([4, 4, 3]);
  });

  test("a whole track of 5 places 4 and reports 1", () => {
    const plan = buildCaseGroupPlan(many(5, "Tech", ["A", "B"]), config);
    expect(placements(plan, "Tech")).toHaveLength(4);
    expect(plan.excluded).toHaveLength(1);
    expect(plan.excluded[0].reason).toMatch(/Could not be placed/);
  });

  test("two people stuck in one slot are reported, not grouped as a pair", () => {
    const apps = [...many(8, "Tech", ["A", "B"]), ...many(2, "Tech", ["C"])];
    const plan = buildCaseGroupPlan(apps, config);
    expect(plan.tracks.Tech.slots.C.count).toBe(0);
    expect(plan.excluded.map((e) => e.applicationId).sort()).toEqual(["app0009", "app0010"]);
  });

  test("moves flexible people so a slot reaches 3", () => {
    // 2 people can only make C; 4 flexible people can top C up to 3 and still leave a valid group
    const apps = [...many(2, "Tech", ["C"]), ...many(5, "Tech", ["A", "C"])];
    const plan = buildCaseGroupPlan(apps, config);
    expect(plan.excluded).toEqual([]);
    expect(groupSizes(plan, "Tech").sort()).toEqual([3, 4]);
  });

  test("reports Unknown track and no availability; reads \"A,B,C\" as three slots", () => {
    const apps = [
      app("Unknown", ["A"]),
      app("Tech", []),
      app("Tech", ["Z"]),
      ...Array.from({ length: 3 }, () => app("Tech", ["A,B,C"])),
    ];
    const plan = buildCaseGroupPlan(apps, config);
    expect(plan.excluded.map((e) => e.reason)).toEqual(["No track", "No case night availability", "No case night availability"]);
    expect(placements(plan, "Tech")).toHaveLength(3);
  });

  test("Non-Tech gets first claim on capacity when a slot is nearly full", () => {
    const tight = { ...config, maxGroupsPerSlot: { A: 1, B: 1, C: 0 } };
    const apps = [...many(4, "Tech", ["A", "B"]), ...many(4, "Non-Tech", ["A"])];
    const plan = buildCaseGroupPlan(apps, tight);
    expect(plan.tracks["Non-Tech"].slots.A.count).toBe(4);
    expect(plan.tracks.Tech.slots.A.count).toBe(0);
    expect(plan.tracks.Tech.slots.B.count).toBe(4);
  });

  test("respects capacity and reports who doesn't fit", () => {
    const tight = { ...config, maxGroupsPerSlot: { A: 1, B: 0, C: 0 } };
    const plan = buildCaseGroupPlan(many(8, "Tech", ["A"]), tight);
    expect(plan.tracks.Tech.slots.A.count).toBe(4);
    expect(plan.excluded).toHaveLength(4);
  });

  test("keeps the least flexible people when not everyone fits", () => {
    const tight = { ...config, maxGroupsPerSlot: { A: 1, B: 0, C: 0 } };
    const flexible = many(4, "Tech", ["A", "B"]);
    const stuck = many(4, "Tech", ["A"]);
    const plan = buildCaseGroupPlan([...flexible, ...stuck], tight);
    const placedIds = placements(plan, "Tech").map((p) => p.member.applicationId).sort();
    expect(placedIds).toEqual(stuck.map((a) => a._id).sort());
  });

  test("same applicants in any order give the same plan", () => {
    const apps = [...many(13, "Tech", ["A", "B"]), ...many(9, "Non-Tech", ["B", "C"]), ...many(3, "Tech", ["C"])];
    const first = buildCaseGroupPlan(apps, config);
    const second = buildCaseGroupPlan([...apps].reverse(), config);
    expect(second).toEqual(first);
    expect(planFingerprint(second)).toBe(planFingerprint(first));
  });

  test("handles a realistic volume quickly", () => {
    const apps = [
      ...many(120, "Tech", ["A", "B", "C"]),
      ...many(40, "Tech", ["B"]),
      ...many(150, "Non-Tech", ["A", "C"]),
      ...many(30, "Non-Tech", ["C"]),
    ];
    const started = Date.now();
    const plan = buildCaseGroupPlan(apps, config);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(plan.summary.placed).toBe(340);
    expect(groupSizes(plan, "Tech").every((n) => n === 3 || n === 4)).toBe(true);
  });
});

describe("planFingerprint", () => {
  test("changes when someone moves group", () => {
    const apps = many(8, "Tech", ["A"]);
    const before = planFingerprint(buildCaseGroupPlan(apps, config));
    const after = planFingerprint(buildCaseGroupPlan(apps.slice(0, 7), config));
    expect(after).not.toBe(before);
  });
});

describe("toAssignmentDocs", () => {
  test("one document per placed person, with track and group details", () => {
    const plan = buildCaseGroupPlan(many(4, "Non-Tech", ["B"]), config);
    const docs = toAssignmentDocs(plan, config, "boss@ucsd.edu");
    expect(docs).toHaveLength(4);
    expect(docs[0]).toEqual({
      applicationId: "app0001",
      applicantName: "Person 1",
      applicantEmail: "p1@ucsd.edu",
      candidateType: "Non-Tech",
      timeSlot: "B",
      timeSlotDisplay: "7:00 PM – 8:00 PM",
      groupNumber: 1,
      groupId: "Non-Tech-B-1",
      assignedBy: "boss@ucsd.edu",
      status: "Assigned",
    });
  });
});

test("stays fast when capacity is far below demand", () => {
  const tight = { ...config, maxGroupsPerSlot: { A: 2, B: 2, C: 2 } };
  const started = Date.now();
  const plan = buildCaseGroupPlan(many(400, "Tech", ["A", "B", "C"]), tight);
  expect(Date.now() - started).toBeLessThan(2000);
  expect(plan.summary.placed).toBe(24);
});
