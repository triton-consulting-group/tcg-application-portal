import { useEffect, useState } from "react";
import { readPublicSettings } from "./api";

export default function usePortalSettings() {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    readPublicSettings().then(data => { if (active) setSettings(data); }).catch(() => {
      if (active) setError("Unable to load current form settings. Reload this page before submitting.");
    });
    return () => { active = false; };
  }, []);
  return { settings, error };
}
