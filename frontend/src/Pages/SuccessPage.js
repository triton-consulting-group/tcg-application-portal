import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const SuccessPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to ApplicationSubmitted after 2 seconds
    const timer = setTimeout(() => {
      navigate("/ApplicationComponents/ApplicationSubmitted");
    }, 2000); // 2-second delay

    return () => clearTimeout(timer); // Cleanup timer on unmount
  }, [navigate]);

  return (
    <div style={{ backgroundColor: "#e2e8f0", minHeight: "100vh", padding: "24px" }}>
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        maxWidth: "600px",
        margin: "40px auto 0 auto",
        padding: "24px",
        borderRadius: "8px",
        boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
        backgroundColor: "white",
        textAlign: "center"
      }}>
        <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#22543d", margin: "0" }}>
          Application Submitted Successfully!
        </h1>
        
        <p style={{ fontSize: "16px", color: "#4a5568", margin: "0", lineHeight: "1.5" }}>
          We have received your application. Our team will review it and get back to you soon.
        </p>
        
        <p style={{ fontSize: "14px", color: "#718096", margin: "0", fontStyle: "italic" }}>
          Redirecting to confirmation page...
        </p>
        
        <button 
          onClick={() => navigate("/ApplicationComponents/ApplicationSubmitted")}
          style={{
            backgroundColor: "#3182ce",
            color: "white",
            border: "none",
            padding: "12px 24px",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "16px",
            marginTop: "16px"
          }}
        >
          Go to Application Submitted
        </button>
      </div>
    </div>
  );
};

export default SuccessPage;
