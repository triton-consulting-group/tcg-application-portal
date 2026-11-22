import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../../config/api";
import { getAdminAuthHeaders } from "../../config/adminAuth";
import { getErrorMessage } from "../../utils/caseGroups";
import { modalStyles as styles } from "./caseGroupModalStyles";

const API = `${API_BASE_URL}/api/case-groups/round`;

const RoundFinalizationModal = ({ cycle, onClose, onFinalized }) => {
  const [kind, setKind] = useState("case-night");
  const [data, setData] = useState(null);
  const [decisions, setDecisions] = useState({});
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const requestId = useRef(0);
  const dialog = useRef(null);
  const applicants = data?.applicants || [];
  const locked = data?.round?.status === "finalized";
  const complete = applicants.length > 0 && applicants.every((a) => decisions[a.applicationId]);
  const payload = () => applicants.map((a) => ({ applicationId: a.applicationId, result: decisions[a.applicationId] }));

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setBusy(true);
    setData(null);
    setDecisions({});
    setPreview(null);
    setError("");
    try {
      const headers = await getAdminAuthHeaders();
      const response = await axios.get(`${API}/finalization`, { headers, params: { cycle, kind } });
      if (id === requestId.current) setData(response.data);
    } catch (err) {
      if (id === requestId.current) setError(await getErrorMessage(err, "Failed to load the round."));
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }, [cycle, kind]);

  useEffect(() => {
    setNotice("");
    load();
    return () => { requestId.current += 1; };
  }, [load]);

  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.focus();
    return () => previous?.focus?.();
  }, []);

  const run = async (finalize) => {
    if (busy || locked || !complete) return;
    setBusy(true);
    setError("");
    try {
      const headers = await getAdminAuthHeaders();
      const response = await axios.post(
        `${API}/${finalize ? "finalize" : "finalization/preview"}`,
        { decisions: payload(), ...(finalize ? { fingerprint: preview.fingerprint } : {}) },
        { headers, params: { cycle, kind } }
      );
      if (finalize) {
        setPreview(null);
        setData((current) => ({
          ...current,
          round: { ...current.round, status: "finalized" },
          applicants: current.applicants.map((applicant) => ({
            ...applicant,
            currentStatus: preview.changes.find((change) => change.applicationId === applicant.applicationId).to
          }))
        }));
        setNotice(`Round finalized. ${response.data.updated} applicant statuses updated. Grades are locked.`);
        onFinalized();
      } else {
        setPreview(response.data);
      }
    } catch (err) {
      setPreview(null);
      if (finalize && err.response?.status === 409) {
        await load();
        setNotice("The round changed after your preview. Review the latest grades, choose decisions, and preview again.");
      } else {
        setError(await getErrorMessage(err, "Failed to save the round."));
      }
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape" && !busy) onClose();
    if (event.key !== "Tab") return;
    const controls = dialog.current.querySelectorAll("button:not(:disabled), select:not(:disabled)");
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <div style={styles.overlay}>
      <div ref={dialog} tabIndex={-1} style={styles.modal} role="dialog" aria-modal="true" aria-label="Finalize recruitment round" onKeyDown={onKeyDown}>
        <div style={styles.header}>
          <h2 style={{ margin: 0 }}>Finalize recruitment round</h2>
          <button onClick={onClose} disabled={busy} style={{ ...styles.secondaryButton, marginLeft: "auto" }}>Close</button>
        </div>
        <p>Review each applicant's grades and choose a decision. The preview shows the status changes before grades are locked.</p>
        <label>Round{" "}
          <select aria-label="Round" value={kind} disabled={busy} onChange={(event) => setKind(event.target.value)} style={styles.select}>
            <option value="case-night">Case Night</option>
            <option value="final-interview">Final interview</option>
          </select>
        </label>
        {cycle && <p style={styles.status}>Recruitment cycle: {cycle}</p>}
        {error && <div role="alert" style={styles.error}>{error}{!data && <button onClick={load} disabled={busy} style={{ ...styles.secondaryButton, marginLeft: "12px" }}>Retry</button>}</div>}
        {notice && <div role="status" style={styles.notice}>{notice}</div>}
        {busy && <p role="status">Loading or saving round…</p>}
        {!busy && data && !data.round && <p>No round has been created for this cycle.</p>}
        {locked && <p>This round is finalized. Grades and decisions are locked.</p>}
        {!busy && data?.round && !applicants.length && <p>This round has no applicants to finalize.</p>}
        {applicants.map((applicant) => (
          <section key={applicant.applicationId} style={styles.card} aria-label={applicant.name}>
            <h3 style={{ margin: "0 0 6px" }}>{applicant.name}</h3>
            <div style={styles.status}>Current status: {applicant.currentStatus}</div>
            {applicant.evaluations.length ? (
              <ul>{applicant.evaluations.map((evaluation, index) => (
                <li key={index}>{evaluation.evaluator}: {evaluation.result}{evaluation.notes ? ` (${evaluation.notes})` : ""}</li>
              ))}</ul>
            ) : <p>No grades recorded. Add a grade before finalizing this applicant.</p>}
            {!locked && <label>Decision for {applicant.name}{" "}
              <select value={decisions[applicant.applicationId] || ""} disabled={busy} style={styles.select} onChange={(event) => {
                setDecisions((current) => ({ ...current, [applicant.applicationId]: event.target.value }));
                setPreview(null);
              }}>
                <option value="">Choose a decision</option>
                <option value="Pass">Pass</option>
                <option value="Fail">Fail</option>
              </select>
            </label>}
          </section>
        ))}
        {preview && <section aria-label="Status change preview" style={styles.section}>
          <h3>Status changes</h3>
          <ul>{preview.changes.map((change) => <li key={change.applicationId}>{change.name}: {change.from} → {change.to}</li>)}</ul>
          {preview.blockers.length > 0 && <div role="alert" style={styles.warning}><ul>{preview.blockers.map((blocker, index) => <li key={index}>{blocker}</li>)}</ul></div>}
          <p>Confirming locks this round's grades and applies these changes.</p>
        </section>}
        {!locked && <div style={styles.actions}>
          <button onClick={() => run(false)} disabled={busy || !complete || applicants.some((a) => !a.evaluations.length)} style={styles.secondaryButton}>Preview status changes</button>
          {preview && <button onClick={() => run(true)} disabled={busy || !preview.fingerprint || preview.blockers.length > 0} style={styles.primaryButton}>Confirm and finalize</button>}
        </div>}
      </div>
    </div>
  );
};

export default RoundFinalizationModal;
