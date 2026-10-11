import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../../config/api";
import { getAdminAuthHeaders } from "../../config/adminAuth";
import { TRACKS, getErrorMessage } from "../../utils/caseGroups";
import { modalStyles as styles } from "./caseGroupModalStyles";

// Preview of automatic case groups, with a button to build them (super admins only)
const BuildCaseGroupsModal = ({ onClose, onBuilt }) => {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const headers = await getAdminAuthHeaders();
      const response = await axios.post(`${API_BASE_URL}/api/case-groups/preview`, {}, { headers });
      setPreview(response.data);
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

  return (
    <div style={styles.overlay}>
      <div style={styles.modal} role="dialog" aria-label="Build Case Groups">
        <h2 style={styles.title}>Build Case Groups</h2>

        {notice && <div style={styles.notice}>{notice}</div>}
        {error && <div style={styles.error}>{error}</div>}
        {loading && <p>Loading preview…</p>}

        {!loading && plan && (
          <>
            <p>
              {plan.summary.eligible} "Case Night - Yes" applicants · <strong>{plan.summary.placed} placed</strong>
              {plan.summary.excluded > 0 && ` · ${plan.summary.excluded} not placed`}
            </p>

            {existing.count > 0 && (
              <div style={existing.emailsSent > 0 ? styles.error : styles.warning}>
                This replaces the {existing.count} current assignments (they're backed up first).
                {existing.emailsSent > 0 && <strong> {existing.emailsSent} of them were already emailed.</strong>}
                {existing.handEditsSinceBuild > 0 && ` ${existing.handEditsSinceBuild} hand edits since the last build will be discarded.`}
              </div>
            )}

            {TRACKS.map((track) => {
              const { placed, groupsOf4, groupsOf3, slots } = plan.tracks[track];
              return (
                <section key={track} style={styles.section}>
                  <h3 style={styles.subtitle}>
                    {track}: {placed} people · {groupsOf4} groups of 4 · {groupsOf3} groups of 3
                  </h3>
                  {Object.entries(slots).map(([slot, { label, count, groups }]) => (
                    <details key={slot} style={styles.slot}>
                      <summary>
                        {label}: {count} people in {groups.length} groups
                      </summary>
                      {groups.map((group) => (
                        <p key={group.groupId} style={styles.group}>
                          <strong>{group.groupId}</strong>: {group.members.map((m) => m.fullName).join(", ")}
                        </p>
                      ))}
                    </details>
                  ))}
                </section>
              );
            })}

            {plan.excluded.length > 0 && (
              <section style={styles.section}>
                <h3 style={styles.subtitle}>Not placed ({plan.excluded.length})</h3>
                <ul>
                  {plan.excluded.map((person) => (
                    <li key={person.applicationId}>
                      {person.fullName} ({person.email}): {person.reason}
                    </li>
                  ))}
                </ul>
              </section>
            )}
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
