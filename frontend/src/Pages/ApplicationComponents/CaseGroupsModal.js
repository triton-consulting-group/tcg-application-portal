import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../../config/api";
import { getAdminAuthHeaders } from "../../config/adminAuth";
import { TRACKS, getErrorMessage, groupAssignments, groupOptions } from "../../utils/caseGroups";
import { modalStyles as styles } from "./caseGroupModalStyles";

const optionToTarget = ({ track, slot, groupNumber }) => ({ track, slot, groupNumber });

// Current case groups, with add / move / remove by hand (super admins only)
const CaseGroupsModal = ({ caseNightConfig, onClose }) => {
  const [assignments, setAssignments] = useState([]);
  const [unassigned, setUnassigned] = useState([]);
  const [addChoice, setAddChoice] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const slotLabels = useMemo(() => caseNightConfig?.slots || {}, [caseNightConfig]);
  const slotKeys = useMemo(() => Object.keys(slotLabels).sort(), [slotLabels]);
  const grouped = useMemo(() => groupAssignments(assignments, slotKeys), [assignments, slotKeys]);
  const options = useMemo(() => groupOptions(grouped, slotLabels), [grouped, slotLabels]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const headers = await getAdminAuthHeaders();
      const [assigned, waiting] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/case-groups/assignments`, { headers }),
        axios.get(`${API_BASE_URL}/api/case-groups/unassigned`, { headers })
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

  // Sends an edit; if the server comes back with warnings, asks the admin and resends with confirmWarnings
  const runEdit = async (method, path, data) => {
    setSaving(true);
    setError("");
    try {
      const headers = await getAdminAuthHeaders();
      const send = (body) => axios({ method, url: `${API_BASE_URL}/api/case-groups${path}`, data: body, headers });
      try {
        await send(data);
      } catch (err) {
        const warnings = err.response?.status === 409 ? err.response.data?.warnings : null;
        if (!warnings) throw err;
        const message = `${warnings.map((w) => `• ${w.message}`).join("\n")}\n\nDo it anyway?`;
        if (!window.confirm(message)) return;
        await send({ ...data, confirmWarnings: true });
      }
      await load();
    } catch (err) {
      setError(await getErrorMessage(err, "That change didn't save."));
    } finally {
      setSaving(false);
    }
  };

  const addApplicant = (applicationId) => {
    const option = options.find((o) => o.value === addChoice[applicationId]);
    if (option) runEdit("post", "/assignments", { applicationId, ...optionToTarget(option) });
  };

  const moveMember = (assignmentId, value) => {
    const option = options.find((o) => o.value === value);
    if (option) runEdit("patch", `/assignments/${assignmentId}`, optionToTarget(option));
  };

  const removeMember = (member) => {
    if (window.confirm(`Take ${member.applicantName} out of ${member.groupId}? Their application isn't changed.`)) {
      runEdit("delete", `/assignments/${member._id}`, {});
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal} role="dialog" aria-label="Case Groups">
        <h2 style={styles.title}>Case Groups</h2>
        {error && <div style={styles.error}>{error}</div>}
        {loading && <p>Loading case groups…</p>}

        {!loading && (
          <>
            <section style={styles.section}>
              <h3 style={styles.subtitle}>Unassigned "Case Night - Yes" applicants ({unassigned.length})</h3>
              {unassigned.length === 0 && <p>Everyone is in a group.</p>}
              {unassigned.map((person) => (
                <div key={person._id} style={styles.row}>
                  <span>
                    {person.fullName} ({person.candidateType}; available:{" "}
                    {(person.caseNightPreferences || []).join(", ") || "none"})
                  </span>
                  <select
                    aria-label={`Group for ${person.fullName}`}
                    style={styles.select}
                    value={addChoice[person._id] || ""}
                    onChange={(e) => setAddChoice({ ...addChoice, [person._id]: e.target.value })}
                  >
                    <option value="">Choose a group…</option>
                    {options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button
                    style={styles.primaryButton}
                    disabled={saving || !addChoice[person._id]}
                    onClick={() => addApplicant(person._id)}
                  >
                    Add
                  </button>
                </div>
              ))}
            </section>

            {TRACKS.map((track) => (
              <section key={track} style={styles.section}>
                <h3 style={styles.subtitle}>{track}</h3>
                {slotKeys.map((slot) => (
                  <div key={slot} style={styles.slot}>
                    <strong>{slotLabels[slot]}</strong>
                    {grouped[track][slot].length === 0 && <p style={styles.group}>No groups.</p>}
                    {grouped[track][slot].map((group) => (
                      <div key={group.groupNumber} style={styles.card}>
                        <strong>
                          {group.groupId} ({group.members.length} {group.members.length === 1 ? "person" : "people"})
                        </strong>
                        {group.members.map((member) => (
                          <div key={member._id} style={styles.row}>
                            <span>{member.applicantName}</span>
                            <select
                              aria-label={`Move ${member.applicantName}`}
                              style={styles.select}
                              value=""
                              disabled={saving}
                              onChange={(e) => moveMember(member._id, e.target.value)}
                            >
                              <option value="">Move to…</option>
                              {options
                                .filter((o) => o.value !== `${track}|${slot}|${group.groupNumber}`)
                                .map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                            </select>
                            <button style={styles.dangerButton} disabled={saving} onClick={() => removeMember(member)}>
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </section>
            ))}
          </>
        )}

        <div style={styles.actions}>
          <button onClick={onClose} style={styles.secondaryButton}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CaseGroupsModal;
