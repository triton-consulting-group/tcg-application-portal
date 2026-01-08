/**
 * Assign Case Night groups WITHOUT Tech/Non-Tech distinction.
 *
 * Policies (hardcoded):
 * 1) Balance slots evenly (targets computed at runtime)
 * 2) Prioritize least-flexible candidates (fewest preferences first)
 * 3) Tie-break by earliest submission (createdAt)
 * 4) Respect per-slot capacity
 * 5) Create groups of config.groupSize (warn if incomplete groups remain)
 */

const mongoose = require("mongoose");
const path = require("path");

const Application = require("../models/Application");
const CaseGroupAssignment = require("../models/CaseGroupAssignment");
const CASE_NIGHT_CONFIG = require("../config/caseNightConfig");

// Load environment variables - support production mode
const envFile = process.argv.includes("--production") ? "production.env" : ".env";
require("dotenv").config({ path: path.join(__dirname, "..", envFile) });

// ---------- Helpers ----------
const uniqueInOrder = (arr) => {
  const seen = new Set();
  const out = [];
  for (const x of arr || []) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
};

const sortedSlotKeys = (slotsObj) => Object.keys(slotsObj).sort();

const buildCapacities = (config) => {
  const slotKeys = sortedSlotKeys(config.slots);
  const groupSize = config.groupSize;

  // Allow either:
  // maxGroupsPerSlot: { A: 50, B: 50, C: 50 }
  // OR legacy maxGroupsPerSlot: 50
  const mgps = config.maxGroupsPerSlot;

  const maxGroupsBySlot = {};
  if (typeof mgps === "number") {
    for (const s of slotKeys) maxGroupsBySlot[s] = mgps;
  } else {
    for (const s of slotKeys) {
      if (typeof mgps?.[s] !== "number") {
        throw new Error(`Missing maxGroupsPerSlot["${s}"] in config`);
      }
      maxGroupsBySlot[s] = mgps[s];
    }
  }

  const capacityBySlot = {};
  for (const s of slotKeys) {
    capacityBySlot[s] = maxGroupsBySlot[s] * groupSize;
  }

  return { slotKeys, groupSize, maxGroupsBySlot, capacityBySlot };
};

const totalCapacity = (capacityBySlot) =>
  Object.values(capacityBySlot).reduce((a, b) => a + b, 0);

const computeTargetsEvenly = (N, slotKeys, capacityBySlot) => {
  const K = slotKeys.length;
  const base = Math.floor(N / K);
  const r = N % K;

  // initial even targets
  const target = {};
  for (let i = 0; i < K; i++) {
    const s = slotKeys[i];
    target[s] = base + (i < r ? 1 : 0);
  }

  // clamp to capacity and redistribute overflow
  let overflow = 0;
  for (const s of slotKeys) {
    if (target[s] > capacityBySlot[s]) {
      overflow += target[s] - capacityBySlot[s];
      target[s] = capacityBySlot[s];
    }
  }

  // redistribute overflow into slots with remaining capacity
  while (overflow > 0) {
    let bestSlot = null;
    let bestRemaining = -1;
    for (const s of slotKeys) {
      const remaining = capacityBySlot[s] - target[s];
      if (remaining > bestRemaining) {
        bestRemaining = remaining;
        bestSlot = s;
      }
    }
    if (!bestSlot || bestRemaining <= 0) break; // nowhere to put overflow
    target[bestSlot] += 1;
    overflow -= 1;
  }

  if (overflow > 0) {
    // This can only happen if total capacity < N
    throw new Error(
      `Not enough total capacity for targets: overflow=${overflow}. Increase maxGroupsPerSlot or reduce candidates.`
    );
  }

  return target;
};

// choose best slot among feasible ones: under-target first, then lowest count, then preference order
const chooseSlot = ({ prefs, feasibleSlots, countBySlot, targetBySlot }) => {
  let best = feasibleSlots[0];
  let bestScore = null;

  for (const s of feasibleSlots) {
    const score1 = countBySlot[s] - targetBySlot[s]; // more negative = more underfilled (better)
    const score2 = countBySlot[s]; // fewer people = better
    const score3 = prefs.indexOf(s); // lower index = better

    const score = [score1, score2, score3];

    if (
      bestScore === null ||
      score[0] < bestScore[0] ||
      (score[0] === bestScore[0] && score[1] < bestScore[1]) ||
      (score[0] === bestScore[0] && score[1] === bestScore[1] && score[2] < bestScore[2])
    ) {
      best = s;
      bestScore = score;
    }
  }

  return best;
};

const assignmentCounts = (assignedBySlot) => {
  const counts = {};
  for (const [slot, arr] of Object.entries(assignedBySlot)) counts[slot] = arr.length;
  return counts;
};

const diffFromTarget = (countBySlot, targetBySlot, slot) =>
  countBySlot[slot] - targetBySlot[slot];

const pickMostUnderfilled = (slotKeys, countBySlot, targetBySlot) => {
  let best = null;
  let bestDelta = Infinity;
  for (const s of slotKeys) {
    const d = diffFromTarget(countBySlot, targetBySlot, s); // negative means under
    if (d < bestDelta) {
      bestDelta = d;
      best = s;
    }
  }
  return best;
};

const pickMostOverfilled = (slotKeys, countBySlot, targetBySlot) => {
  let best = null;
  let bestDelta = -Infinity;
  for (const s of slotKeys) {
    const d = diffFromTarget(countBySlot, targetBySlot, s); // positive means over
    if (d > bestDelta) {
      bestDelta = d;
      best = s;
    }
  }
  return best;
};

const canMove = (candidate, toSlot, countBySlot, capacityBySlot) => {
  return candidate.prefs.includes(toSlot) && countBySlot[toSlot] < capacityBySlot[toSlot];
};

// Simple rebalance: move flexible candidates from most-overfilled -> most-underfilled until within target
const rebalance = ({
  slotKeys,
  assignedBySlot,
  countBySlot,
  targetBySlot,
  capacityBySlot,
  maxIterations = 5000,
}) => {
  let iter = 0;

  while (iter < maxIterations) {
    iter++;

    const overSlot = pickMostOverfilled(slotKeys, countBySlot, targetBySlot);
    const underSlot = pickMostUnderfilled(slotKeys, countBySlot, targetBySlot);

    if (!overSlot || !underSlot) break;

    const overDelta = diffFromTarget(countBySlot, targetBySlot, overSlot);
    const underDelta = diffFromTarget(countBySlot, targetBySlot, underSlot);

    // Stop if no meaningful imbalance
    if (overDelta <= 0 || underDelta >= 0) break;

    // Find a movable candidate in overSlot who can go to underSlot.
    // Prefer more flexible candidates so we don't harm constrained people.
    const movable = assignedBySlot[overSlot]
      .filter((c) => canMove(c, underSlot, countBySlot, capacityBySlot))
      .sort((a, b) => {
        // more prefs first
        if (b.prefs.length !== a.prefs.length) return b.prefs.length - a.prefs.length;
        // less penalty for moving to underSlot (earlier preference is better)
        return a.prefs.indexOf(underSlot) - b.prefs.indexOf(underSlot);
      });

    if (movable.length === 0) break;

    const c = movable[0];

    // execute move
    assignedBySlot[overSlot] = assignedBySlot[overSlot].filter((x) => x._id.toString() !== c._id.toString());
    assignedBySlot[underSlot].push(c);
    countBySlot[overSlot] -= 1;
    countBySlot[underSlot] += 1;
  }
};

// ---------- Main ----------
const assignCaseGroups = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Clear existing assignments
    const deleteResult = await CaseGroupAssignment.deleteMany({});
    console.log(`🗑️  Cleared ${deleteResult.deletedCount} existing assignments`);

    const { slotKeys, groupSize, capacityBySlot } = buildCapacities(CASE_NIGHT_CONFIG);

    // Get all applications with case night preferences (NO candidateType filter)
    const applicationsRaw = await Application.find({
      caseNightPreferences: { $exists: true, $ne: [], $not: { $size: 0 } },
    }).sort({ createdAt: 1 });

    console.log(`\n📊 Found ${applicationsRaw.length} applications with case night preferences`);

    if (applicationsRaw.length === 0) {
      console.log("No applications to assign");
      return;
    }

    // Sanitize preferences
    const candidates = applicationsRaw
      .map((app) => {
        const cleaned = uniqueInOrder(app.caseNightPreferences).filter((s) => slotKeys.includes(s));
        return { ...app.toObject(), _id: app._id, prefs: cleaned, createdAt: app.createdAt };
      })
      .filter((c) => c.prefs.length > 0);

    const N = candidates.length;
    console.log(`✅ Valid candidates after sanitizing preferences: ${N}`);

    const capTotal = totalCapacity(capacityBySlot);
    console.log(`\n🧮 Total capacity: ${capTotal} people`);
    for (const s of slotKeys) {
      console.log(`- Slot ${s} (${CASE_NIGHT_CONFIG.slots[s]}): cap ${capacityBySlot[s]}`);
    }

    if (N > capTotal) {
      throw new Error(
        `Not enough capacity: candidates=${N}, totalCapacity=${capTotal}. Increase maxGroupsPerSlot or reduce candidates.`
      );
    }

    // Targets
    const targetBySlot = computeTargetsEvenly(N, slotKeys, capacityBySlot);
    console.log(`\n🎯 Slot targets (even distribution):`);
    for (const s of slotKeys) {
      console.log(`- ${s}: target ${targetBySlot[s]}`);
    }

    // Sort candidates: least flexible first, then earliest submission
    candidates.sort((a, b) => {
      if (a.prefs.length !== b.prefs.length) return a.prefs.length - b.prefs.length;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    // Assign
    const assignedBySlot = {};
    const countBySlot = {};
    for (const s of slotKeys) {
      assignedBySlot[s] = [];
      countBySlot[s] = 0;
    }

    const unassigned = [];

    for (const c of candidates) {
      const feasible = c.prefs.filter((s) => countBySlot[s] < capacityBySlot[s]);
      if (feasible.length === 0) {
        unassigned.push(c);
        continue;
      }

      const chosen = chooseSlot({
        prefs: c.prefs,
        feasibleSlots: feasible,
        countBySlot,
        targetBySlot,
      });

      assignedBySlot[chosen].push(c);
      countBySlot[chosen] += 1;
    }

    if (unassigned.length > 0) {
      console.log(`\n⚠️ Unassigned candidates (capacity/preference constraints): ${unassigned.length}`);
      // You can decide whether to throw here. For now we warn and continue.
    }

    // Rebalance to reduce target deviations
    rebalance({
      slotKeys,
      assignedBySlot,
      countBySlot,
      targetBySlot,
      capacityBySlot,
    });

    console.log(`\n📌 Final slot counts after rebalance:`);
    for (const s of slotKeys) {
      console.log(`- ${s}: ${countBySlot[s]} (target ${targetBySlot[s]})`);
    }

    // Create DB assignments with groups
    const assignments = [];
    for (const slot of slotKeys) {
      const members = assignedBySlot[slot].slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      for (let i = 0; i < members.length; i += groupSize) {
        const groupMembers = members.slice(i, i + groupSize);
        const groupNumber = Math.floor(i / groupSize) + 1;

        // Warn if incomplete
        if (groupMembers.length < groupSize) {
          console.log(
            `⚠️ Incomplete group: Slot ${slot} Group ${groupNumber} has ${groupMembers.length}/${groupSize} members`
          );
        }

        for (const m of groupMembers) {
          assignments.push({
            applicationId: m._id,
            applicantName: m.fullName,
            applicantEmail: m.email,
            candidateType: m.candidateType, // ⭐ ADD THIS LINE
            timeSlot: slot,
            timeSlotDisplay: CASE_NIGHT_CONFIG.slots[slot],
            groupNumber: groupNumber,
            groupId: `${slot}-${groupNumber}`,
            assignedBy: "system",
            status: "Assigned",
          });
        }
      }
    }

    // Insert into DB
    if (assignments.length > 0) {
      const result = await CaseGroupAssignment.insertMany(assignments);
      console.log(`\n✅ Successfully created ${result.length} case group assignments`);
    } else {
      console.log(`\n⚠️ No assignments generated`);
    }

    // Summary report (NO candidateType grouping)
    console.log(`\n📈 Assignment Summary (by slot):`);

    const summary = await CaseGroupAssignment.aggregate([
      {
        $group: {
          _id: { timeSlot: "$timeSlot" },
          count: { $sum: 1 },
          groups: { $addToSet: "$groupNumber" },
        },
      },
      { $sort: { "_id.timeSlot": 1 } },
    ]);

    summary.forEach((stat) => {
      const slot = stat._id.timeSlot;
      const slotName = CASE_NIGHT_CONFIG.slots[slot];
      const groupCount = stat.groups.length;
      console.log(`- ${slotName}: ${stat.count} people in ${groupCount} groups`);
    });

    // Group distribution
    console.log(`\n👥 Group Distribution:`);
    const groupStats = await CaseGroupAssignment.aggregate([
      {
        $group: {
          _id: { timeSlot: "$timeSlot", groupNumber: "$groupNumber" },
          members: { $push: "$applicantName" },
        },
      },
      { $sort: { "_id.timeSlot": 1, "_id.groupNumber": 1 } },
    ]);

    groupStats.forEach((g) => {
      const slotName = CASE_NIGHT_CONFIG.slots[g._id.timeSlot];
      console.log(`- ${slotName} Group ${g._id.groupNumber}: ${g.members.length} members`);
    });

    console.log(`\n✅ Case group assignment completed successfully!`);
  } catch (error) {
    console.error("❌ Error assigning case groups:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

// Run the script
assignCaseGroups();
