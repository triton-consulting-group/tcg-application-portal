import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./Home/firebaseConfig";
import adminApi from "./AdminManagement/api";
import AdminDirectory from "./AdminManagement/AdminDirectory";
import AdminEditor from "./AdminManagement/AdminEditor";
import AdminDialog from "./AdminManagement/AdminDialog";
import { canManage, errorMessage, roleLabel } from "./AdminManagement/permissions";
import "./AdminManagement/adminManagement.css";

export default function AdminManagementPage() {
  const [admins, setAdmins] = useState([]);
  const [email, setEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const session = useRef(0);
  const mutation = useRef(false);
  const invalidateSession = useCallback(() => ++session.current, []);
  const caller = admins.find(admin => admin.email.toLowerCase() === email);

  const load = useCallback(async (version) => {
    setLoading(true);
    setError("");
    try {
      const data = await adminApi.list();
      if (version === session.current) setAdmins(data);
      return data;
    } catch (failure) {
      if (version === session.current) {
        setAdmins([]);
        setError(errorMessage(failure, "Could not load admins. Please try again."));
      }
      return null;
    } finally {
      if (version === session.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const version = invalidateSession();
      setEmail(user?.email?.toLowerCase() || null);
      setAdmins([]);
      setEditor(null);
      setConfirmation(null);
      setNotice("");
      setActionError("");
      setSaving(false);
      if (user) load(version);
      else { setLoading(false); setError(""); }
    });
    return () => { invalidateSession(); unsubscribe(); };
  }, [load, invalidateSession]);

  const saveAdmin = async (changes) => {
    if (mutation.current) return;
    mutation.current = true;
    setSaving(true);
    const version = session.current;
    try {
      if (editor.target) await adminApi.update(editor.target.email, changes);
      else await adminApi.create(changes);
      if (version !== session.current) return;
      const message = editor.target ? "Admin changes saved." : "Admin created.";
      setEditor(null);
      setNotice(message);
      await load(version);
    } finally {
      mutation.current = false;
      setSaving(false);
    }
  };

  const changeStatus = async () => {
    if (mutation.current) return;
    mutation.current = true;
    setSaving(true);
    setActionError("");
    const version = session.current;
    const target = confirmation;
    try {
      if (target.isActive) await adminApi.deactivate(target.email);
      else await adminApi.update(target.email, { isActive: true });
      if (version !== session.current) return;
      setConfirmation(null);
      setNotice(`${target.email} ${target.isActive ? "deactivated" : "reactivated"}.`);
      await load(version);
    } catch (failure) {
      if (version === session.current) setActionError(errorMessage(failure, "Could not change account status. Please try again."));
    } finally {
      mutation.current = false;
      setSaving(false);
    }
  };

  const hasAccess = canManage(caller);
  return (
    <main className="admin-management">
      <header className="admin-heading">
        <div><h1>Admin Management</h1><p className="admin-muted">Manage your team’s accounts and portal access.</p>
          {caller && <p className="admin-muted">Signed in as {caller.name} · {roleLabel(caller.role)}</p>}</div>
        <div className="admin-actions">
          <Link className="admin-button admin-secondary" to="/associate">Back to Associate Portal</Link>
          {hasAccess && <><button type="button" className="admin-button admin-secondary" disabled={loading || saving}
            onClick={() => load(session.current)}>Refresh</button>
            <button type="button" className="admin-button" disabled={loading || saving} onClick={() => setEditor({ target: null })}>Add admin</button></>}
        </div>
      </header>
      {notice && <p role="status" className="admin-message admin-notice">{notice}</p>}
      {loading ? <p role="status" className="admin-empty">Loading admin management…</p> : !email ? (
        <section className="admin-empty"><h2>Sign in to manage admins</h2><p>Use an account with admin-management access.</p><Link className="admin-button" to="/admin-login">Sign in with Google</Link></section>
      ) : error ? (
        <section className="admin-empty"><p role="alert" className="admin-message admin-error">{error}</p>
          <button type="button" className="admin-button" onClick={() => load(session.current)}>Retry</button></section>
      ) : !hasAccess ? (
        <section className="admin-empty"><h2>Management access required</h2><p>Only super admins and admins with management permission can manage accounts.</p></section>
      ) : <>
        <section className="admin-overview" aria-label="Account overview">
          {[["Total admins", admins.length], ["Active", admins.filter(admin => admin.isActive).length],
            ["Inactive", admins.filter(admin => !admin.isActive).length],
            ["Active super admins", admins.filter(admin => admin.isActive && admin.role === "super_admin").length]]
            .map(([label, count]) => <div className="admin-stat" key={label}><span>{label}</span><strong>{count}</strong></div>)}
        </section>
        <AdminDirectory admins={admins} caller={caller} disabled={saving || loading}
          onView={target => setEditor({ target, readOnly: true })}
          onEdit={target => setEditor({ target })}
          onStatus={target => { setConfirmation(target); setActionError(""); }} />
        <p className="admin-muted admin-footer-note">Deactivation removes administrative access without deleting the account or its history.</p>
      </>}
      {editor && hasAccess && <AdminEditor target={editor.target} caller={caller} readOnly={editor.readOnly} onSave={saveAdmin} onClose={() => setEditor(null)} />}
      {confirmation && hasAccess && <AdminDialog title={`${confirmation.isActive ? "Deactivate" : "Reactivate"} admin`} busy={saving} onClose={() => setConfirmation(null)}>
        <p>{confirmation.isActive ? "Remove administrative access for" : "Restore administrative access for"} <strong>{confirmation.name}</strong> ({confirmation.email})?</p>
        <p className="admin-muted">{confirmation.isActive ? "The account is kept and can be reactivated later." : "The account will regain its saved role and permissions."}</p>
        {actionError && <p role="alert" className="admin-message admin-error">{actionError}</p>}
        <div className="admin-actions admin-dialog-actions">
          <button type="button" className="admin-button admin-secondary" disabled={saving} onClick={() => setConfirmation(null)}>Cancel</button>
          <button type="button" className={`admin-button ${confirmation.isActive ? "admin-danger" : "admin-success"}`} disabled={saving} onClick={changeStatus}>
            {saving ? "Saving…" : confirmation.isActive ? "Deactivate admin" : "Reactivate admin"}
          </button>
        </div>
      </AdminDialog>}
    </main>
  );
}
