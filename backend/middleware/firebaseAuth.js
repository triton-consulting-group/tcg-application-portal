const { getFirebaseAuth } = require("../config/firebaseAdmin");

// Verifies the request carries a valid, email-verified Firebase ID token
// belonging to the applicant named by req.params.email.
const verifyFirebaseOwner = async (req, res, next) => {
  try {
    const bearerToken = req.headers["authorization"]?.replace("Bearer ", "");
    if (!bearerToken) {
      return res.status(401).json({ error: "❌ Missing authentication token." });
    }

    const decoded = await getFirebaseAuth().verifyIdToken(bearerToken);

    // Firebase's client API key is public, so anyone can self-register an
    // arbitrary email via the Identity Toolkit REST API and get back a
    // validly-signed token for it. Google sign-ins always verify the email;
    // requiring that here closes that bypass.
    if (!decoded.email_verified) {
      return res.status(403).json({ error: "❌ Email not verified." });
    }

    const routeEmail = (req.params.email || "").toLowerCase();
    if (!decoded.email || decoded.email.toLowerCase() !== routeEmail) {
      return res.status(403).json({ error: "❌ You can only access your own application." });
    }

    req.verifiedEmail = decoded.email; // used by the per-user rate limiter
    next();
  } catch (error) {
    console.error("❌ Error verifying Firebase token:", error);
    res.status(401).json({ error: "❌ Invalid or expired authentication token." });
  }
};

module.exports = { verifyFirebaseOwner };
