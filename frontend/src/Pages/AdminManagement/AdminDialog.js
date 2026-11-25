import React, { useEffect, useRef, useId } from "react";

// Native modal dialogs provide focus containment and restore focus when closed.
export default function AdminDialog({ title, onClose, busy = false, children }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog ref={ref} className="admin-dialog" aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
      <div className="admin-dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="admin-button admin-secondary" aria-label="Close dialog" onClick={onClose} disabled={busy}>×</button>
      </div>
      {children}
    </dialog>
  );
}
