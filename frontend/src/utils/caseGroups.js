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

// Current assignments nested for display: track → slot → groups (by number) → members (by name)
export const groupAssignments = (assignments, slotKeys) => {
  const tracks = Object.fromEntries(TRACKS.map((track) => [track, Object.fromEntries(slotKeys.map((slot) => [slot, []]))]));

  for (const assignment of assignments) {
    const groups = tracks[assignment.candidateType]?.[assignment.timeSlot];
    if (!groups) continue;
    let group = groups.find((g) => g.groupNumber === assignment.groupNumber);
    if (!group) {
      group = { groupNumber: assignment.groupNumber, groupId: assignment.groupId, members: [] };
      groups.push(group);
    }
    group.members.push(assignment);
  }

  for (const bySlot of Object.values(tracks)) {
    for (const groups of Object.values(bySlot)) {
      groups.sort((a, b) => a.groupNumber - b.groupNumber);
      groups.forEach((g) => g.members.sort((a, b) => a.applicantName.localeCompare(b.applicantName)));
    }
  }
  return tracks;
};

// Choices for "put this person in…": every existing group, plus a new group for each track and slot
export const groupOptions = (grouped, slotLabels) =>
  Object.entries(grouped).flatMap(([track, bySlot]) =>
    Object.entries(bySlot).flatMap(([slot, groups]) => [
      ...groups.map((g) => ({
        value: `${track}|${slot}|${g.groupNumber}`,
        label: `${g.groupId} (${g.members.length} ${g.members.length === 1 ? "person" : "people"})`,
        track,
        slot,
        groupNumber: g.groupNumber
      })),
      {
        value: `${track}|${slot}|new`,
        label: `New ${track} group at ${slotLabels[slot] || slot}`,
        track,
        slot,
        groupNumber: "new"
      }
    ])
  );
