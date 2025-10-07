import React, { useState, useEffect } from "react";
import { signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from "firebase/auth";
import { auth, provider } from "./firebaseConfig"; // ✅ Use exported auth and provider

export default function AuthButton({ onSuccessfulSignIn }) {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Listen for auth state changes and check for redirect results
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
        });
        
        // Check if user just returned from redirect
        getRedirectResult(auth).then((result) => {
            if (result) {
                console.log("Redirect sign-in successful:", result.user.displayName);
                if (onSuccessfulSignIn && typeof onSuccessfulSignIn === 'function') {
                    onSuccessfulSignIn();
                }
            }
        }).catch((error) => {
            console.error("Redirect sign-in error:", error);
        });
        
        // Cleanup subscription
        return () => unsubscribe();
    }, [onSuccessfulSignIn]);

    const handleSignIn = async () => {
        setIsLoading(true);
        try {
            // Try redirect method instead of popup
            await signInWithRedirect(auth, provider);
        } catch (error) {
            console.error("Error signing in:", error.message);
            alert("Failed to sign in: " + error.message);
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
                backgroundColor: user ? "#718096" : "#3182ce",
                color: "white",
                border: "none",
                padding: "12px 24px",
                borderRadius: "6px",
                cursor: isLoading ? "default" : "pointer",
                fontSize: "16px",
                fontWeight: "500",
                width: "200px",
                height: "48px",
                margin: "0 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: isLoading ? 0.7 : 1,
                transition: "all 0.3s ease",
            }}
        >
            {isLoading ? (
                "Loading..."
            ) : (
                user ? `Sign Out (${user.displayName})` : "Sign in with Google"
            )}
        </button>
    );
}
