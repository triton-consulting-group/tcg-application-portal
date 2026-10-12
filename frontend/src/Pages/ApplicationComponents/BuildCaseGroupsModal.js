import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../../config/api";
import { getAdminAuthHeaders } from "../../config/adminAuth";
import { TRACKS, getErrorMessage, boardFromPlan, searchMatches } from "../../utils/caseGroups";
import CaseGroupBoard, { TrackTabs, busiestTrack } from "./CaseGroupBoard";
import { modalStyles as styles } from "./caseGroupModalStyles";

// Slot labels ("6:00 PM – 7:00 PM") from the plan
const labelsFromPlan = (plan) =>
  Object.fromEntries(
    TRACKS.flatMap((t) => Object.entries(plan.tracks[t]?.slots || {}).map(([slot, { label }]) => [slot, label]))
  );

// Preview of automatic case groups on the same board as the Case Groups window, read-only,
// with a button to build them (super admins only)
const BuildCaseGroupsModal = ({ onClose, onBuilt }) => {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [track, setTrack] = useState(TRACKS[0]);
  const [query, setQuery] = useState("");

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const headers = await getAdminAuthHeaders();
      const response = await axios.post(`${API_BASE_URL}/api/case-groups/preview`, {}, { headers });
      setPreview(response.data);
      setTrack(busiestTrack(boardFromPlan(response.data.plan)));
    } catch (err) {
      setError(await getErrorMessage(err, "Failed to preview case groups."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const build = async () => {
    setBuilding(true);
    setError("");
    try {
      const headers = await getAdminAuthHeaders();
      const response = await axios.post(
        `${API_BASE_URL}/api/case-groups/build`,
        { fingerprint: preview.fingerprint },
        { headers }
      );
      onBuilt(response.data.created);
    } catch (err) {
      if (err.response?.status === 409) {
        setNotice("Applicants changed since this preview. Here's the updated preview — check it and confirm again.");
        await loadPreview();
      } else {
        setError(await getErrorMessage(err, "Failed to build case groups."));
      }
    } finally {
      setBuilding(false);
    }
  };

  const { plan, existing } = preview || {};
  const board = useMemo(() => (plan ? boardFromPlan(plan) : null), [plan]);
  const slotLabels = useMemo(() => (plan ? labelsFromPlan(plan) : {}), [plan]);
  const matches = useMemo(() => (board ? searchMatches(board, query) : []), [board, query]);
  const matchIds = query.trim() ? new Set(matches.map((m) => m.id)) : null;
  const trackPlan = plan?.tracks[track];

  return (
    <div style={styles.overlay}>
      <div style={styles.largeModal} role="dialog" aria-label="Build Case Groups">
        <div style={styles.header}>
          <h2 style={{ margin: 0 }}>Build Case Groups</h2>
          {board && <TrackTabs board={board} track={track} onChange={setTrack} />}
          {board && (
            <input
              type="search"
              aria-label="Search by name"
              placeholder="🔍 Search by name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={styles.search}
            />
          )}
          {query.trim() && (
            <span style={styles.status}>
              {matches.length} {matches.length === 1 ? "match" : "matches"}
            </span>
          )}
        </div>

        {notice && <div style={styles.notice}>{notice}</div>}
        {error && <div style={styles.error}>{error}</div>}
        {loading && <p>Loading preview…</p>}

        {!loading && plan && (
          <>
            <p style={{ margin: "0 0 8px" }}>
              {plan.summary.eligible} "Case Night - Yes" applicants · <strong>{plan.summary.placed} placed</strong>
              {plan.summary.excluded > 0 && ` · ${plan.summary.excluded} not placed`}
              {trackPlan && (
                <span style={styles.status}>
                  {" "}
                  — {track}: {trackPlan.groupsOf4} groups of 4, {trackPlan.groupsOf3} groups of 3
                </span>
              )}
            </p>

            {existing.count > 0 && (
              <div style={{ ...(existing.emailsSent > 0 ? styles.error : styles.warning), margin: "0 0 10px" }}>
                This replaces the {existing.count} current assignments (they're backed up first).
                {existing.emailsSent > 0 && <strong> {existing.emailsSent} of them were already emailed.</strong>}
                {existing.handEditsSinceBuild > 0 && ` ${existing.handEditsSinceBuild} hand edits since the last build will be discarded.`}
              </div>
            )}

            <CaseGroupBoard board={board} track={track} slotLabels={slotLabels} matchIds={matchIds} trayTitle="Not placed" />
          </>
        )}

        <div style={styles.actions}>
          <button onClick={onClose} style={styles.secondaryButton} disabled={building}>
            Cancel
          </button>
          <button
            onClick={build}
            style={styles.primaryButton}
            disabled={loading || building || !plan || plan.summary.placed === 0}
          >
            {building ? "Building…" : "Confirm and build"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BuildCaseGroupsModal;
