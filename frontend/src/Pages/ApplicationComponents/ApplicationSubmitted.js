import React from "react";

const ApplicationSubmitted = () => {
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
        <h1 style={{ fontSize: "28px", fontWeight: "bold", color: "#22543d", margin: "0 0 16px 0" }}>
          Application Submitted Successfully!
        </h1>
        
        <p style={{ fontSize: "18px", color: "#2d3748", margin: "0 0 12px 0", lineHeight: "1.6" }}>
          Thank you for applying to Triton Consulting Group. We have received your application and will be reviewing it shortly.
        </p>
        
        <p style={{ fontSize: "16px", color: "#4a5568", margin: "0 0 20px 0", lineHeight: "1.5" }}>
          You will receive an email confirmation with the next steps of our application process.
        </p>

        <div style={{
          backgroundColor: "#f7fafc",
          padding: "12px",
          borderRadius: "6px",
          border: "1px solid #e2e8f0",
          margin: "0 0 20px 0"
        }}>
          <p style={{ fontSize: "14px", color: "#718096", margin: "0", fontStyle: "italic" }}>
            Application ID: {Math.random().toString(36).substring(2, 10).toUpperCase()}
          </p>
        </div>
        
        <button 
          onClick={() => window.location.href = "/"}
          style={{
            backgroundColor: "#3182ce",
            color: "white",
            border: "none",
            padding: "12px 24px",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "16px",
            width: "100%"
          }}
        >
          Return to Home
        </button>
      </div>
    </div>
  );
};

export default ApplicationSubmitted;