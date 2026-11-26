import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged, signInWithPopup } from "firebase/auth";
import { auth, provider, getSignInErrorMessage } from "../Home/firebaseConfig";
import { readSettings, saveSettings } from "./api";
import "./portalSettings.css";

const clone = value => JSON.parse(JSON.stringify(value));
const message = error => error.response?.data?.error || "Unable to contact the server. Please try again.";
const pacific = value => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("en-US", { timeZone: "America/Los_Angeles", timeZoneName: "short" }) : "Invalid date";

export default function PortalSettingsPage() {
  const [saved, setSaved] = useState(null);
  const [values, setValues] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const generation = useRef(0);
  const pending = useRef(false);
  const dirty = saved && JSON.stringify(saved.values) !== JSON.stringify(values);

  const load = useCallback(async version => {
    setLoading(true);
    setError("");
    try {
      const data = await readSettings();
      if (generation.current !== version) return;
      setSaved(data);
      setValues(clone(data.values));
    } catch (failure) {
      if (generation.current === version) { setSaved(null); setValues(null); setError(message(failure)); }
    } finally { if (generation.current === version) setLoading(false); }
  }, []);
  useEffect(() => {
    const epoch = generation;
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, account => {
      if (!active) return;
      const version = ++generation.current;
      setUser(account); setValues(null); setSaved(null); setError(""); setNotice("");
      if (account) load(version); else setLoading(false);
    });
    return () => { active = false; epoch.current++; unsubscribe(); };
  }, [load]);
  useEffect(() => {
    const warn = event => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const change = (path, value) => setValues(previous => {
    const next = clone(previous);
    let target = next;
    path.slice(0, -1).forEach(key => { target = target[key]; });
    target[path[path.length - 1]] = value;
    return next;
  });
  const save = async event => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    if (pending.current) return;
    if (!window.confirm("Publish these settings? Dates affect application submissions and slot settings affect future scheduling.")) return;
    pending.current = true; setBusy(true); setError(""); setNotice("");
    const version = generation.current;
    try {
      const data = await saveSettings({ revision: saved.revision, values });
      if (version !== generation.current) return;
      setSaved(data); setValues(clone(data.values)); setNotice("Settings published.");
    } catch (failure) { if (version === generation.current) setError(message(failure)); }
    finally { pending.current = false; setBusy(false); }
  };
  const field = (label, path, value, maxLength = 500) => <label key={path.join(".")}>{label}<input required maxLength={maxLength} value={value} onChange={event => change(path, event.target.value)} /></label>;

  const signIn = async () => {
    setSigningIn(true);
    setError("");
    try { await signInWithPopup(auth, provider); }
    catch (failure) { setError(getSignInErrorMessage(failure)); }
    finally { setSigningIn(false); }
  };

  if (!loading && !user) return <main className="portal-settings settings-login">
    <section className="settings-login-card" aria-labelledby="settings-login-title">
      <h1 id="settings-login-title">Portal Settings</h1>
      <p>Sign in with your super-admin account to manage portal settings.</p>
      {error && <p role="alert" className="settings-error">{error}</p>}
      <button type="button" className="settings-login-button" disabled={signingIn} onClick={signIn}>{signingIn ? "Signing in..." : "Sign in with Google"}</button>
      <Link className="settings-home-button" to="/">Return to Home</Link>
    </section>
  </main>;

  return <main className="portal-settings">
    <header><h1>Portal settings</h1><Link to="/associate" onClick={event => { if (dirty && !window.confirm("Discard unsaved settings?")) event.preventDefault(); }}>Back to Associate Portal</Link></header>
    <p>Configure the current portal. The cycle display name does not change which applications belong to a recruitment cycle.</p>
    {error && <p role="alert" className="settings-error">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {loading ? <p role="status">Loading settings…</p> : <>
      <button type="button" disabled={busy} onClick={() => { if (!dirty || window.confirm("Discard unsaved settings and reload?")) load(generation.current); }}>Reload saved settings</button>
      {values && <form onSubmit={save}><fieldset disabled={busy}>
        <section><h2>Recruitment</h2>{field("Cycle display name", ["cycleName"], values.cycleName, 100)}</section>
        <section><h2>Application dates</h2>
          <label className="settings-check"><input type="checkbox" checked={values.window.isActive} onChange={event => change(["window", "isActive"], event.target.checked)} />Enforce the application window</label>
          <p>Enter dates with a timezone, for example 2026-10-08T23:59:00-07:00. Pacific time is shown below each date. Disabling enforcement allows submissions outside these dates.</p>
          {field("Opening date and time", ["window", "applicationStart"], values.window.applicationStart, 40)}<p>{pacific(values.window.applicationStart)}</p>
          {field("Deadline", ["window", "applicationDeadline"], values.window.applicationDeadline, 40)}<p>{pacific(values.window.applicationDeadline)}</p>
          {field("Before-opening message", ["window", "preStartMessage"], values.window.preStartMessage)}
          {field("Closed message", ["window", "message"], values.window.message)}
        </section>
        <section><h2>Case Night</h2>
          {field("Event date (display text)", ["caseNight", "date"], values.caseNight.date, 100)}
          <p>The scheduler builds groups of three or four. Slot IDs are fixed so existing availability selections remain valid. Changes do not rebuild existing assignments.</p>
          {Object.keys(values.caseNight.slots).map(slot => <div className="settings-slot" key={slot}>
            {field(`Slot ${slot} time / label`, ["caseNight", "slots", slot], values.caseNight.slots[slot], 100)}
            <label>Maximum groups for slot {slot}<input type="number" required min="1" max="1000" step="1" value={values.caseNight.maxGroupsPerSlot[slot]} onChange={event => change(["caseNight", "maxGroupsPerSlot", slot], event.target.value === "" ? "" : Number(event.target.value))} /></label>
          </div>)}
        </section>
        <section><h2>Form wording</h2><p>Edit the existing questions and instructions. Required fields, answer types, and word limits stay the same.</p>
          {Object.entries(values.wording).map(([key, value]) => field(key.replace(/([A-Z])/g, " $1"), ["wording", key], value))}
        </section>
        <div className="settings-actions"><button type="button" onClick={() => setPreview(!preview)}>{preview ? "Hide" : "Show"} wording preview</button><button type="button" disabled={!dirty} onClick={() => { if (window.confirm("Discard unsaved settings?")) { setValues(clone(saved.values)); setError(""); } }}>Cancel changes</button><button type="submit" disabled={!dirty}>{busy ? "Saving…" : "Save and publish"}</button></div>
      </fieldset></form>}
      {preview && values && <section aria-label="Wording preview"><h2>APPLICATION - {values.cycleName}</h2>{Object.entries(values.wording).map(([key, value]) => <p key={key}>{value}</p>)}</section>}
    </>}
  </main>;
}
