// Shared inline styles for the case group windows (matches the inline-style approach in AssociatePage.js)
const button = {
  border: "none",
  padding: "8px 16px",
  borderRadius: "4px",
  cursor: "pointer",
  fontSize: "14px"
};

export const modalStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "16px"
  },
  modal: {
    backgroundColor: "white",
    color: "#222",
    borderRadius: "8px",
    padding: "24px",
    width: "100%",
    maxWidth: "860px",
    maxHeight: "90vh",
    overflowY: "auto"
  },
  title: { marginTop: 0 },
  subtitle: { fontSize: "16px", margin: "0 0 8px 0" },
  section: { marginTop: "16px" },
  slot: { margin: "4px 0 4px 8px" },
  group: { margin: "4px 0 4px 16px", fontSize: "14px" },
  warning: { backgroundColor: "#fff3cd", border: "1px solid #ffe08a", padding: "10px 12px", borderRadius: "6px", margin: "12px 0" },
  error: { backgroundColor: "#f8d7da", border: "1px solid #f1aeb5", padding: "10px 12px", borderRadius: "6px", margin: "12px 0" },
  notice: { backgroundColor: "#e3f2fd", border: "1px solid #bbdefb", padding: "10px 12px", borderRadius: "6px", margin: "12px 0" },
  actions: { display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" },
  primaryButton: { ...button, backgroundColor: "#007bff", color: "white" },
  secondaryButton: { ...button, backgroundColor: "#e9ecef", color: "#222" },
  dangerButton: { ...button, backgroundColor: "#dc3545", color: "white", padding: "4px 10px", fontSize: "12px" },
  row: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", margin: "4px 0", fontSize: "14px" },
  select: { padding: "4px", fontSize: "12px", maxWidth: "260px" },
  card: { border: "1px solid #dee2e6", borderRadius: "6px", padding: "8px 12px", margin: "8px 0" },
  // Near-full-screen window for the board views
  largeModal: {
    backgroundColor: "white",
    color: "#1f2937",
    borderRadius: "10px",
    padding: "16px 20px",
    width: "95vw",
    height: "90vh",
    display: "flex",
    flexDirection: "column",
    fontSize: "15px"
  },
  header: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "10px" },
  status: { color: "#475569", fontSize: "14px" },
  moving: { color: "#1e3a8a", fontWeight: 600, fontSize: "14px" },
  search: { padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "14px", minWidth: "200px" },
  warnBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    backgroundColor: "#fff7ed",
    border: "1px solid #fdba74",
    borderRadius: "8px",
    padding: "10px 14px",
    marginTop: "10px"
  }
};

// Size badge colours by sizeTone()
const TONES = {
  small: { backgroundColor: "#fee2e2", color: "#991b1b" },
  three: { backgroundColor: "#e0e7ff", color: "#3730a3" },
  four: { backgroundColor: "#dcfce7", color: "#166534" },
  big: { backgroundColor: "#f3e8ff", color: "#6b21a8" }
};

export const boardStyles = {
  tabs: { display: "flex", gap: "6px" },
  tab: (active) => ({
    padding: "6px 14px",
    borderRadius: "999px",
    border: `1px solid ${active ? "#1e3a8a" : "#cbd5e1"}`,
    backgroundColor: active ? "#1e3a8a" : "white",
    color: active ? "white" : "#1f2937",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 600
  }),
  board: { display: "flex", gap: "10px", flex: 1, minHeight: 0 },
  tray: (target) => ({
    width: "200px",
    flexShrink: 0,
    overflowY: "auto",
    backgroundColor: target ? "#eff6ff" : "#fefce8",
    border: `2px dashed ${target ? "#2563eb" : "#facc15"}`,
    borderRadius: "10px",
    padding: "10px",
    cursor: target ? "pointer" : "default"
  }),
  trayHint: { fontSize: "13px", color: "#1e3a8a", fontWeight: 600, margin: "0 0 8px" },
  trayItem: { marginBottom: "6px" },
  reason: { display: "block", fontSize: "12px", color: "#9a3412", margin: "2px 0 0 4px" },
  column: (unavailable) => ({
    flex: 1,
    minWidth: "220px",
    overflowY: "auto",
    borderRadius: "10px",
    padding: "10px",
    background: unavailable
      ? "repeating-linear-gradient(45deg, #f8fafc, #f8fafc 8px, #eef2f7 8px, #eef2f7 16px)"
      : "#f8fafc"
  }),
  columnTitle: { fontSize: "15px", margin: "0 0 10px", display: "flex", justifyContent: "space-between", gap: "8px" },
  columnNote: { color: "#64748b", fontWeight: 400, fontSize: "13px" },
  card: (state) => ({
    backgroundColor: state === "target" ? "#eff6ff" : "white",
    border: state === "target" ? "2px dashed #2563eb" : "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "8px 10px",
    marginBottom: "10px",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
    opacity: state === "unavailable" ? 0.6 : 1,
    cursor: state === "target" || state === "unavailable" ? "pointer" : "default"
  }),
  newCard: (unavailable) => ({
    border: `2px dashed ${unavailable ? "#94a3b8" : "#2563eb"}`,
    borderRadius: "10px",
    padding: "10px",
    textAlign: "center",
    color: unavailable ? "#64748b" : "#1e3a8a",
    fontWeight: 600,
    cursor: "pointer",
    backgroundColor: unavailable ? "white" : "#eff6ff"
  }),
  cardTitle: { display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 600, marginBottom: "6px" },
  badge: (tone) => ({ ...TONES[tone], borderRadius: "999px", padding: "1px 9px", fontSize: "13px", fontWeight: 700 }),
  chip: ({ selected, mismatch, match, dimmed, clickable }) => ({
    display: "inline-block",
    margin: "0 4px 4px 0",
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: "14px",
    border: `1px solid ${selected ? "#1e3a8a" : mismatch ? "#fb923c" : "#c7d2fe"}`,
    backgroundColor: selected ? "#1e3a8a" : mismatch ? "#fff7ed" : "#eef2ff",
    color: selected ? "white" : "#1f2937",
    boxShadow: match ? "0 0 0 3px #facc15" : selected ? "0 0 0 3px #bfdbfe" : "none",
    opacity: dimmed ? 0.35 : 1,
    cursor: clickable ? "grab" : "default",
    fontFamily: "inherit"
  })
};
