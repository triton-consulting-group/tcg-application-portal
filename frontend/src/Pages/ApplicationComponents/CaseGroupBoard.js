import React from "react";
import { TRACKS, mismatchReason, sizeTone } from "../../utils/caseGroups";
import { boardStyles as s } from "./caseGroupModalStyles";

const plural = (n) => `${n} ${n === 1 ? "person" : "people"}`;

// Everyone on a track's board: group members plus the tray
export const trackCount = ({ slots, unassigned }) =>
  Object.values(slots).reduce((sum, groups) => sum + groups.reduce((t, g) => t + g.members.length, 0), 0) +
  unassigned.length;

// The track with the most people (the one to open first)
export const busiestTrack = (board) =>
  TRACKS.reduce((best, t) => (trackCount(board[t]) > trackCount(board[best]) ? t : best), TRACKS[0]);

export const TrackTabs =({ board, track, onChange }) => (
  <div role="tablist" aria-label="Track" style={s.tabs}>
    {TRACKS.map((t) => (
      <button key={t} type="button" role="tab" aria-selected={t === track} style={s.tab(t === track)} onClick={() => onChange(t)}>
        {t} · {trackCount(board[t])}
      </button>
    ))}
  </div>
);

const PersonChip = ({ person, from, slotLabels, mismatch, moving, matchIds, editable, onPick }) => {
  const selected = moving?.person.id === person.id;
  const match = Boolean(matchIds?.has(person.id));
  const availability = person.prefs
    ? `Available: ${person.prefs.map((slot) => slotLabels[slot] || slot).join(", ") || "none"}`
    : null;
  const title = [mismatch, person.reason, availability].filter(Boolean).join(". ") || undefined;
  const style = s.chip({ selected, mismatch: Boolean(mismatch), match, dimmed: matchIds && !match, clickable: editable });

  if (!editable) {
    return (
      <span style={style} title={title} data-person-id={person.id} data-match={match || undefined}>
        {person.name}
      </span>
    );
  }

  return (
    <button
      type="button"
      style={style}
      title={title}
      data-person-id={person.id}
      data-match={match || undefined}
      draggable
      onDragStart={(e) => {
        e.dataTransfer?.setData?.("text/plain", String(person.id));
        onPick(person, from, { drag: true });
      }}
      onClick={(e) => {
        // While moving someone else, a click on this chip counts as a click on its group (the target)
        if (moving && !selected) return;
        e.stopPropagation();
        onPick(person, from);
      }}
    >
      {person.name}
    </button>
  );
};

// Group columns for one track, with the tray on the left.
// Editable boards support picking a person (click or drag) and choosing a target:
//   { kind: "group", slot, groupNumber } | { kind: "new", slot } | { kind: "tray" }
const CaseGroupBoard = ({
  board,
  track,
  slotLabels,
  editable = false,
  moving = null,
  matchIds = null,
  trayTitle = "Unassigned",
  onPick,
  onTarget
}) => {
  const { slots, unassigned } = board[track];
  const mover = moving?.person;
  const dropProps = (target) =>
    editable
      ? {
          onDragOver: (e) => e.preventDefault(),
          onDrop: (e) => {
            e.preventDefault();
            onTarget(target);
          }
        }
      : {};
  const trayIsTarget = Boolean(editable && moving?.from);

  return (
    <div style={s.board}>
      <section
        aria-label={trayTitle}
        style={s.tray(trayIsTarget)}
        onClick={() => trayIsTarget && onTarget({ kind: "tray" })}
        {...dropProps({ kind: "tray" })}
      >
        <h4 style={{ margin: "0 0 8px" }}>
          {trayTitle} ({unassigned.length})
        </h4>
        {trayIsTarget && <p style={s.trayHint}>Drop here to take {mover.name} out of their group</p>}
        {unassigned.length === 0 && <p style={{ fontSize: "13px", color: "#64748b" }}>Nobody here.</p>}
        {unassigned.map((person) => (
          <div key={person.id} style={s.trayItem}>
            <PersonChip
              person={person}
              from={null}
              slotLabels={slotLabels}
              moving={moving}
              matchIds={matchIds}
              editable={editable}
              onPick={onPick}
            />
            {person.reason && <small style={s.reason}>{person.reason}</small>}
          </div>
        ))}
      </section>

      {Object.entries(slots).map(([slot, groups]) => {
        const label = slotLabels[slot] || slot;
        const people = groups.reduce((sum, g) => sum + g.members.length, 0);
        const unavailable = Boolean(mover?.prefs && !mover.prefs.includes(slot));

        return (
          <div key={slot} style={s.column(editable && unavailable)}>
            <h4 style={s.columnTitle}>
              <span>{label}</span>
              <span style={s.columnNote}>
                {editable && unavailable ? `${mover.name} didn't pick this` : `${plural(people)} · ${groups.length} groups`}
              </span>
            </h4>

            {groups.map((group) => {
              const isSource =
                moving?.from && moving.from.slot === slot && moving.from.groupNumber === group.groupNumber;
              const state = !editable || !moving || isSource ? null : unavailable ? "unavailable" : "target";
              const target = { kind: "group", slot, groupNumber: group.groupNumber };

              return (
                <div
                  key={group.groupNumber}
                  role={editable ? "button" : "group"}
                  aria-label={`Group ${group.groupNumber} at ${label}, ${plural(group.members.length)}`}
                  style={s.card(state)}
                  onClick={() => state && onTarget(target)}
                  {...dropProps(target)}
                >
                  <div style={s.cardTitle}>
                    <span>Group {group.groupNumber}</span>
                    <span style={s.badge(sizeTone(group.members.length))}>{group.members.length}</span>
                  </div>
                  {group.members.map((person) => (
                    <PersonChip
                      key={person.id}
                      person={person}
                      from={{ track, slot, groupNumber: group.groupNumber }}
                      slotLabels={slotLabels}
                      mismatch={mismatchReason(person, slot, track, slotLabels)}
                      moving={moving}
                      matchIds={matchIds}
                      editable={editable}
                      onPick={onPick}
                    />
                  ))}
                </div>
              );
            })}

            {editable && moving && (
              <div
                role="button"
                aria-label={`New group at ${label}`}
                style={s.newCard(unavailable)}
                onClick={() => onTarget({ kind: "new", slot })}
                {...dropProps({ kind: "new", slot })}
              >
                + New group
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CaseGroupBoard;
