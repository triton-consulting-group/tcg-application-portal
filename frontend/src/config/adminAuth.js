import { auth } from "../Pages/Home/firebaseConfig";

// Returns headers carrying the signed-in user's Firebase ID token.
// getIdToken() refreshes an expired token automatically.
export const getAdminAuthHeaders = async () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Not signed in");
  }
  const idToken = await user.getIdToken();
  return { Authorization: `Bearer ${idToken}` };
};
