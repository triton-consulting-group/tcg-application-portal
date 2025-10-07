import React, { useState, useEffect } from "react";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { auth, provider } from "./firebaseConfig"; // ✅ Use exported auth and provider

export default function AuthButton({ onSuccessfulSignIn }) {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Listen for auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            console.log("AuthButton: User state changed:", user ? user.email : "No user");
        });
        
        // Cleanup subscription
        return () => unsubscribe();
    }, []);

    const handleSignIn = async () => {
        setIsLoading(true);
        try {
            // Use popup method to avoid page refresh
            const result = await signInWithPopup(auth, provider);
            console.log("Popup sign-in successful:", result.user.displayName);
            // Call the callback after successful sign-in
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
