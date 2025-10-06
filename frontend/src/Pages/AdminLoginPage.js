import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, signInWithPopup } from "firebase/auth";
import { provider } from "./Home/firebaseConfig";
import API_BASE_URL from "../config/api";

const AdminLoginPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAdminLogin = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const auth = getAuth();
      const result = await signInWithPopup(auth, provider);
      
      // Check if the user is an admin
      const response = await fetch("${API_BASE_URL}/api/admin/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: result.user.email }),
      });

      const data = await response.json();
      
      if (data.isAdmin) {
        // Redirect to associate page
        navigate("/associate");
      } else {
        setError("Access denied. This email is not registered as an admin.");
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("Failed to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#f7fafc"
    }}>
      <div style={{
        backgroundColor: "white",
        padding: "32px",
        borderRadius: "8px",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        maxWidth: "400px",
        width: "100%"
      }}>
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "24px"
        }}>
          <h1 style={{
            fontSize: "24px",
            fontWeight: "bold",
            textAlign: "center",
            margin: "0"
          }}>
            TCG Admin Portal
          </h1>
          
          <p style={{
            textAlign: "center",
            color: "#4a5568",
            margin: "0"
          }}>
            Sign in with your admin Google account to access the associate portal.
          </p>

          {error && (
            <div style={{
              backgroundColor: "#fed7d7",
              border: "1px solid #feb2b2",
              borderRadius: "4px",
              padding: "12px",
              color: "#c53030"
            }}>
              ❌ {error}
            </div>
          )}

          <button
            onClick={handleAdminLogin}
            disabled={loading}
            style={{
              backgroundColor: "#3182ce",
              color: "white",
              border: "none",
              borderRadius: "6px",
              padding: "12px 24px",
              fontSize: "16px",
              fontWeight: "500",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              width: "100%"
            }}
          >
            {loading ? "Signing in..." : "Sign in with Google"}
          </button>

          <button
            onClick={() => navigate("/")}
            style={{
              backgroundColor: "transparent",
              color: "#4a5568",
              border: "none",
              padding: "8px 16px",
              fontSize: "14px",
              cursor: "pointer",
              textDecoration: "underline"
            }}
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage; 