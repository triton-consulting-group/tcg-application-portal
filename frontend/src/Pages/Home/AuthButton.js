import React, { useState, useEffect } from "react";
import { getAuth, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { provider } from "./firebaseConfig"; // ✅ Correct import

const auth = getAuth(); // ✅ Get Firebase authentication instance

export default function AuthButton({ onSuccessfulSignIn }) {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Listen for auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
        });
        
        // Cleanup subscription
        return () => unsubscribe();
    }, []);

    const handleSignIn = async () => {
        setIsLoading(true);
        try {
            const result = await signInWithPopup(auth, provider);
            setUser(result.user);
            console.log("Signed in as:", result.user.displayName);
            
            // Call the onSuccessfulSignIn callback if provided
            if (onSuccessfulSignIn && typeof onSuccessfulSignIn === 'function') {
                onSuccessfulSignIn();
            }
        } catch (error) {
            console.error("Error signing in:", error.message);
            alert("Failed to sign in: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignOut = async () => {
        setIsLoading(true);
        try {
            await signOut(auth);
            setUser(null);
            console.log("Signed out successfully");
        } catch (error) {
            console.error("Error signing out:", error.message);
            alert("Failed to sign out: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            onClick={user ? handleSignOut : handleSignIn}
            disabled={isLoading}
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 20px",
                backgroundColor: user ? "#ff4d4d" : "#4285F4",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: isLoading ? "default" : "pointer",
                opacity: isLoading ? 0.7 : 1,
                transition: "all 0.3s ease",
                fontFamily: "Roboto, Arial, sans-serif",
                fontSize: "14px",
                fontWeight: "500",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.25)",
                width: "220px",
                height: "42px",
            }}
        >
            {isLoading ? (
                "Loading..."
            ) : (
                <>
                    {!user && (
                        <img
                            src="https://authjs.dev/img/providers/google.svg"
                            alt="Google Logo"
                            style={{ width: "18px", height: "18px", marginRight: "10px" }}
                        />
                    )}
                    {user ? `Sign Out (${user.displayName})` : "Sign in with Google"}
                </>
            )}
        </button>
    );
}
