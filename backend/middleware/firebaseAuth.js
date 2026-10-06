const admin = require("../config/firebaseAdmin");

// Returns { decoded } for a valid, email-verified token, or { status, error }.
const checkFirebaseToken = async (req) => {
  const bearerToken = req.headers["authorization"]?.replace("Bearer ", "");
  if (!bearerToken) {
    return { status: 401, error: "❌ Missing authentication token." };
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(bearerToken);
  } catch (error) {
    console.error("❌ Error verifying Firebase token:", error);
    return { status: 401, error: "❌ Invalid or expired authentication token." };
  }

  // Firebase's client API key is public, so anyone can self-register an
  // arbitrary email via the Identity Toolkit REST API and get back a
  // validly-signed token for it. Google sign-ins always verify the email;
  // requiring that here closes that bypass.
  if (!decoded.email_verified) {
    return { status: 403, error: "❌ Email not verified." };
  }

  return { decoded };
};

// Verifies the request carries a valid, email-verified Firebase ID token
// belonging to the applicant named by req.params.email.
const verifyFirebaseOwner = async (req, res, next) => {
  const { decoded, status, error } = await checkFirebaseToken(req);
  if (error) {
    return res.status(status).json({ error });
  }

  const routeEmail = (req.params.email || "").toLowerCase();
  if (!decoded.email || decoded.email.toLowerCase() !== routeEmail) {
    return res.status(403).json({ error: "❌ You can only access your own application." });
  }

  next();
};

// Verifies a valid, email-verified Firebase ID token and exposes its email
// as req.firebaseEmail. Use this when the route is not tied to a URL email.
const requireFirebaseUser = async (req, res, next) => {
  const { decoded, status, error } = await checkFirebaseToken(req);
  if (error) {
    return res.status(status).json({ error });
  }

  if (!decoded.email) {
    return res.status(403).json({ error: "❌ Token has no email." });
  }

  req.firebaseEmail = decoded.email;
  next();
};

module.exports = { verifyFirebaseOwner, requireFirebaseUser };
