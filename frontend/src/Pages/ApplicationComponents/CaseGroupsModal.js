import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../../config/api";
import { getAdminAuthHeaders } from "../../config/adminAuth";
import { TRACKS, getErrorMessage, boardFromAssignments, searchMatches } from "../../utils/caseGroups";
import CaseGroupBoard, { TrackTabs, busiestTrack } from "./CaseGroupBoard";
import { modalStyles as styles } from "./caseGroupModalStyles";

const API = `${API_BASE_URL}/api/case-groups`;

// One-line summary for a track: people, groups, unassigned, groups under 3
const summarize = ({ slots, unassigned }) => {
  const groups = Object.values(slots).flat();
  const small = groups.filter((g) => g.members.length < 3).length;
  return [
    `${groups.reduce((sum, g) => sum + g.members.length, 0)} in groups`,
    `${groups.length} groups`,
    `${unassigned.length} unassigned`,
    small > 0 ? `${small} under 3` : null
  ]
    .filter(Boolean)
    .join(" · ");
};

// Current case groups as a board, with click-or-drag moves (super admins only)
const CaseGroupsModal = ({ caseNightConfig, onClose }) => {
  const [assignments, setAssignments] = useState([]);
  const [unassigned, setUnassigned] = useState([]);
  const [track, setTrack] = useState(TRACKS[0]);
  const [query, setQuery] = useState("");
  const [moving, setMoving] = useState(null); // { person, from: { track, slot, groupNumber } | null }
  const [pending, setPending] = useState(null); // { target, warnings } waiting for "Move anyway"
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const choseTrack = useRef(false);

  const slotLabels = useMemo(() => caseNightConfig?.slots || {}, [caseNightConfig]);
  const slotKeys = useMemo(() => Object.keys(slotLabels).sort(), [slotLabels]);
  const board = useMemo(() => boardFromAssignments(assignments, unassigned, slotKeys), [assignments, unassigned, slotKeys]);
  const matches = useMemo(() => searchMatches(board, query), [board, query]);
  const matchIds = useMemo(() => (query.trim() ? new Set(matches.map((m) => m.id)) : null), [matches, query]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const headers = await getAdminAuthHeaders();
      const [assigned, waiting] = await Promise.all([
        axios.get(`${API}/assignments`, { headers }),
        axios.get(`${API}/unassigned`, { headers })
      ]);
      setAssignments(assigned.data);
      setUnassigned(waiting.data);
    } catch (err) {
      setError(await getErrorMessage(err, "Failed to load case groups."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // On first load, open the track with the most people
  useEffect(() => {
    if (loading || choseTrack.current) return;
    choseTrack.current = true;
    setTrack(busiestTrack(board));
  }, [loading, board]);

  // Search: when the results change, show the track with the first match and scroll to it.
  // (Reads the track from a ref so switching tabs yourself mid-search isn't undone.)
  const trackRef = useRef(track);
  trackRef.current = track;
  useEffect(() => {
    if (matches.length === 0) return;
    const first = matches.find((m) => m.track === trackRef.current) || matches[0];
    if (first.track !== trackRef.current) setTrack(first.track);
    document.querySelector(`[data-person-id="${first.id}"]`)?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }, [matches]);

  const cancelMove = useCallback(() => {
    setMoving(null);
    setPending(null);
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && cancelMove();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancelMove]);

  const pick = (person, from, { drag = false } = {}) => {
    setPending(null);
    setMoving((current) => (!drag && current?.person.id === person.id ? null : { person, from }));
  };

  // The request for moving `moving.person` to `target`, or null if there's nothing to do
  const requestFor = (target, confirmWarnings) => {
    const { person, from } = moving;
    const confirm = confirmWarnings ? { confirmWarnings: true } : {};
    if (target.kind === "tray") {
      return from ? { method: "delete", url: `${API}/assignments/${person.assignmentId}`, data: confirm } : null;
    }
    const sameGroup =
      from && from.track === track && from.slot === target.slot && from.groupNumber === target.groupNumber;
    if (sameGroup) return null;
    const data = { track, slot: target.slot, groupNumber: target.kind === "new" ? "new" : target.groupNumber, ...confirm };
    return from
      ? { method: "patch", url: `${API}/assignments/${person.assignmentId}`, data }
      : { method: "post", url: `${API}/assignments`, data: { applicationId: person.applicationId, ...data } };
  };

  const move = async (target, confirmWarnings = false) => {
    if (!moving || saving) return;
    const request = requestFor(target, confirmWarnings);
    if (!request) return cancelMove();

    setSaving(true);
    setError("");
    try {
      const headers = await getAdminAuthHeaders();
      await axios({ ...request, headers });
      cancelMove();
      await load();
    } catch (err) {
      const warnings = err.response?.status === 409 ? err.response.data?.warnings : null;
      if (warnings) {
        setPending({ target, warnings });
      } else {
        setError(await getErrorMessage(err, "That change didn't save."));
        cancelMove();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.largeModal} role="dialog" aria-label="Case Groups">
        <div style={styles.header}>
          <h2 style={{ margin: 0 }}>Case Groups</h2>
          {!loading && <TrackTabs board={board} track={track} onChange={setTrack} />}
          <input
            type="search"
            aria-label="Search by name"
            placeholder="🔍 Search by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={styles.search}
          />
          {query.trim() && (
            <span style={styles.status}>
              {matches.length} {matches.length === 1 ? "match" : "matches"}
            </span>
          )}
          <button onClick={onClose} style={{ ...styles.secondaryButton, marginLeft: "auto" }}>
            Close
          </button>
        </div>

        <div style={{ marginBottom: "10px" }}>
          {moving ? (
            <span style={styles.moving}>
              Moving {moving.person.name}: click a group (or drag onto one). Esc to cancel.
            </span>
          ) : (
            !loading && (
              <span style={styles.status}>
                {summarize(board[track])}. Click or drag a name to move it.
              </span>
            )
          )}
        </div>

        {error && <div style={styles.error}>{error}</div>}
        {loading ? (
          <p>Loading case groups…</p>
        ) : (
          <CaseGroupBoard
            board={board}
            track={track}
            slotLabels={slotLabels}
            editable
            moving={moving}
            matchIds={matchIds}
            onPick={pick}
            onTarget={move}
          />
        )}

        {pending && (
          <div role="alert" style={styles.warnBar}>
            <div>
              <strong>Before moving {moving?.person.name}:</strong>
              <ul style={{ margin: "4px 0 0", paddingLeft: "20px" }}>
                {pending.warnings.map((w) => (
                  <li key={w.code}>{w.message}</li>
                ))}
              </ul>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={cancelMove} style={styles.secondaryButton}>
                Cancel
              </button>
              <button onClick={() => move(pending.target, true)} style={styles.primaryButton} disabled={saving}>
                Move anyway
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CaseGroupsModal;
