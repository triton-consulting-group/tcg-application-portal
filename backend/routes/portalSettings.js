const router = require("express").Router();
const Settings = require("../models/PortalSettings");
const { requireAdminAuth } = require("../middleware/adminPermissions");
const { readSettings, validate } = require("../services/portalSettings");

router.get("/public", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store").json((await readSettings()).values);
  } catch (error) {
    res.status(503).json({ error: "Portal settings are unavailable. Please try again." });
  }
});

router.use(requireAdminAuth, (req, res, next) => {
  if (req.admin.role !== "super_admin") return res.status(403).json({ error: "Only super admins can manage portal settings." });
  next();
});

router.get("/", async (req, res) => {
  try { res.set("Cache-Control", "no-store").json(await readSettings()); }
  catch (error) { res.status(503).json({ error: "Unable to load settings." }); }
});

router.put("/", async (req, res) => {
  try {
    const { revision, values } = req.body;
    if (!Number.isSafeInteger(revision) || revision < 0) return res.status(400).json({ error: "A valid settings revision is required." });
    const validated = validate(values);
    const update = { values: validated, revision: revision + 1, updatedBy: req.admin.email };
    let saved;
    if (revision === 0) saved = await Settings.create({ _id: "portal", ...update });
    else saved = await Settings.findOneAndUpdate({ _id: "portal", revision }, { $set: update }, { new: true, runValidators: true });
    if (!saved) return res.status(409).json({ error: "Settings changed since you opened this page. Reload before saving." });
    res.json({ revision: saved.revision, values: saved.values });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "Settings changed since you opened this page. Reload before saving." });
    res.status(error.status || 500).json({ error: error.status ? error.message : "Unable to save settings." });
  }
});

module.exports = router;
