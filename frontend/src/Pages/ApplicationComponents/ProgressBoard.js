import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../../config/api";
import { getAdminAuthHeaders } from "../../config/adminAuth";

// Mirrors backend/services/gradeProgress.js: only these statuses are graded, one round each
const ROUND_BY_STATUS = { "Case Night - Yes": "case_study", "Final Interview - Yes": "final_interview" };
export const ROUND_LABELS = { case_study: "Case Study", final_interview: "Final Interview" };
export const roundForStatus = (status) => ROUND_BY_STATUS[status] || null;

export const POLL_MS = 20000;

const FILTERS = [
  ["all", "All"],
  ["ungraded", "Ungraded"],
  ["split", "Split"],
  ["mine", "Not graded by me"]
];

const matchesFilter = (applicant, filter) => {
  if (filter === "ungraded") return applicant.ungraded;
  if (filter === "split") return applicant.split === true;
  if (filter === "mine") return !applicant.myDecision;
  return true;
};

const badge = (text, color) => (
  <span style={{ backgroundColor: color, color: "white", padding: "2px 8px", borderRadius: "4px", fontSize: "12px", marginRight: "6px" }}>
    {text}
  </span>
);

// Live grading progress for the two graded rounds. The server redacts the breakdown and split flag
// for applicants the viewer hasn't graded yet, so this component only renders what it's given.
const ProgressBoard = ({ onOpenApplicant, reloadSignal }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [round, setRound] = useState("case_study");
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    try {
      const headers = await getAdminAuthHeaders();
      const response = await axios.get(`${API_BASE_URL}/api/grades/progress`, { headers });
      setData(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load grading progress.");
    }
  }, []);

  // Load now, and again whenever a grade is saved elsewhere on the page
  useEffect(() => {
    load();
  }, [load, reloadSignal]);

  // Poll while the tab is visible; refresh as soon as it becomes visible again
  useEffect(() => {
    const isVisible = () => document.visibilityState !== "hidden";
    const interval = setInterval(() => {
      if (isVisible()) load();
    }, POLL_MS);
    const onVisibilityChange = () => {
      if (isVisible()) load();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [load]);

  if (!data) {
    return <p style={{ padding: "16px" }}>{error || "Loading grading progress..."}</p>;
  }

  const totals = data.rounds[round];
  const rows = data.applicants.filter((a) => a.round === round && matchesFilter(a, filter));

  return (
    <div style={{ padding: "16px 0" }}>
      <div className="tabs">
        {Object.entries(ROUND_LABELS).map(([key, label]) => (
          <button key={key} className={round === key ? "active" : ""} onClick={() => setRound(key)}>
            {label} ({data.rounds[key].total})
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", margin: "16px 0" }}>
        <span><strong>{totals.graded}/{totals.total}</strong> fully graded</span>
        <span style={{ color: "#c21807" }}><strong>{totals.ungraded}</strong> ungraded</span>
        <span style={{ color: "#b7791f" }}><strong>{totals.split}</strong> split</span>
        <span style={{ color: "#666", fontSize: "13px" }}>
          Graded = at least {data.requiredGrades} grades. Updates every {POLL_MS / 1000}s.
        </span>
      </div>
      {!data.canSeeAll && (
        <p style={{ color: "#666", fontSize: "13px", margin: "0 0 12px 0" }}>
          Other reviewers' grades and split flags appear only after you grade an applicant.
        </p>
      )}
      {error && <p style={{ color: "#c21807", margin: "0 0 12px 0" }}>{error} Showing the last loaded data.</p>}

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            style={{
              padding: "6px 12px",
              borderRadius: "16px",
              border: "1px solid #20354a",
              backgroundColor: filter === key ? "#20354a" : "white",
              color: filter === key ? "white" : "#20354a",
              cursor: "pointer"
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Track</th>
            <th>Grades</th>
            <th>Your Grade</th>
            <th>Breakdown</th>
            <th>Flags</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.applicationId} className="clickable-row" onClick={() => onOpenApplicant(a.applicationId)}>
              <td>{a.fullName}</td>
              <td>{a.candidateType}</td>
              <td>{a.gradeCount}/{data.requiredGrades}</td>
              <td>{a.myDecision || "—"}</td>
              <td>
                {a.counts
                  ? `Yes ${a.counts.Yes} · No ${a.counts.No} · Maybe ${a.counts.Maybe}`
                  : <span style={{ color: "#999" }}>Hidden until you grade</span>}
              </td>
              <td>
                {a.ungraded && badge("Ungraded", "#c21807")}
                {a.split && badge("Split", "#b7791f")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p style={{ padding: "16px", color: "#666" }}>No applicants match this filter.</p>}
    </div>
  );
};

export default ProgressBoard;
