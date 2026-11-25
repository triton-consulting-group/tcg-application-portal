import React, { useRef, useState } from "react";
import AdminDialog from "./AdminDialog";
import { DEFAULT_PERMISSIONS, PERMISSIONS, LEGACY_PERMISSIONS, roleLabel, errorMessage } from "./permissions";

export default function AdminEditor({ target, caller, readOnly = false, onSave, onClose }) {
  const [name, setName] = useState(target?.name || "");
  const [email, setEmail] = useState(target?.email || "");
  const [role, setRole] = useState(target?.role || "admin");
  const [permissions, setPermissions] = useState({ ...(target ? target.permissions : DEFAULT_PERMISSIONS) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const isSuper = caller.role === "super_admin";
  const isSelf = target?.email === caller.email;
  const title = readOnly ? "Admin details" : target ? "Edit admin" : "Add admin";

  const submit = async (event) => {
    event.preventDefault();
    if (pending.current || readOnly) return;
    if (!name.trim()) { setError("Name is required."); return; }
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) { setError("Enter a valid email address."); return; }
    const changes = { name: name.trim() };
    if (!target) {
      Object.assign(changes, { email: normalizedEmail, role, permissions });
    } else {
      if (role !== target.role) changes.role = role;
      // Send only changed, enforceable flags; preserve every other stored setting.
      const changed = Object.fromEntries(PERMISSIONS
        .filter(({ key }) => !!permissions[key] !== !!target.permissions?.[key])
        .map(({ key }) => [key, !!permissions[key]]));
      if (Object.keys(changed).length) changes.permissions = changed;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await onSave(changes);
    } catch (failure) {
      setError(errorMessage(failure, "Could not save this admin. Please try again."));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <AdminDialog title={title} onClose={onClose} busy={busy}>
      <form onSubmit={submit} className="admin-form">
        {error && <p role="alert" className="admin-message admin-error">{error}</p>}
        <label>Name<input autoFocus name="name" required maxLength={150} value={name} readOnly={readOnly} disabled={busy}
          onChange={(event) => setName(event.target.value)} /></label>
        <label>Email<input name="email" type="email" required value={email} readOnly={!!target || readOnly} disabled={busy}
          onChange={(event) => setEmail(event.target.value)} /></label>
        {target && <p className="admin-muted">Email identifies this account and cannot be changed here.</p>}
        <label>Role<select value={role} disabled={busy || readOnly || !isSuper || isSelf}
          onChange={(event) => setRole(event.target.value)}>
          <option value="admin">Admin</option><option value="super_admin">Super admin</option>
        </select></label>
        {isSelf && !readOnly && <p className="admin-muted">You cannot remove your own management access.</p>}
        {!isSuper && !readOnly && <p className="admin-muted">Only super admins can change roles or grant management access.</p>}
        {target && <p>Status: <strong>{target.isActive ? "Active" : "Inactive"}</strong></p>}
        <fieldset disabled={busy || readOnly || role === "super_admin"}>
          <legend>Permissions</legend>
          {role === "super_admin" && <p className="admin-muted">Super admins have full access regardless of saved permission flags.</p>}
          {PERMISSIONS.map(({ key, label, description }) => (
            <label key={key} className="admin-permission">
              <input type="checkbox" checked={role === "super_admin" || !!permissions[key]}
                disabled={key === "canManageAdmins" && (!isSuper || isSelf)}
                onChange={(event) => setPermissions(previous => ({ ...previous, [key]: event.target.checked }))} />
              <span>{label}<small>{description}</small></span>
            </label>
          ))}
        </fieldset>
        <details className="admin-legacy">
          <summary>Existing permission settings</summary>
          <p>These saved flags are not independent access controls in the current portal. Active admins can view applications; phase movement uses “Change application status.” These values are preserved.</p>
          <dl>{LEGACY_PERMISSIONS.map(({ key, label }) => (
            <div key={key}><dt>{label}</dt><dd>{permissions[key] ? "Enabled" : "Disabled"}</dd></div>
          ))}</dl>
        </details>
        {!target && <p className="admin-muted">This grants portal access to an existing Google account. No invitation email is sent.</p>}
        {!readOnly && role === "super_admin" && target?.role !== "super_admin" &&
          <p className="admin-message">This grants full administrative access, including management of other super admins.</p>}
        <div className="admin-actions admin-dialog-actions">
          <button type="button" className="admin-button admin-secondary" disabled={busy} onClick={onClose}>{readOnly ? "Close" : "Cancel"}</button>
          {!readOnly && <button type="submit" className="admin-button" disabled={busy}>{busy ? "Saving…" : target ? "Save changes" : "Create admin"}</button>}
        </div>
        {readOnly && <p className="admin-muted">{roleLabel(role)} account · {email}</p>}
      </form>
    </AdminDialog>
  );
}
