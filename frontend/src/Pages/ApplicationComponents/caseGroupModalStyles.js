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
  card: { border: "1px solid #dee2e6", borderRadius: "6px", padding: "8px 12px", margin: "8px 0" }
};
