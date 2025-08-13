import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

 // ✅ Import useNavigate for redirection
import axios from "axios";

const ApplicationPage = () => {
  const navigate = useNavigate(); // ✅ Initialize useNavigate
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get('email');

  const [formData, setFormData] = useState({
    email: emailParam || "",
    fullName: "",
    studentYear: "",
    major: "",
    appliedBefore: "",
    candidateType: "",
    resume: null, 
    transcript: null, 
    image: null,
    reason: "",
    caseNightPreferences: []
  });

  const [caseNightConfig, setCaseNightConfig] = useState(null);

  const [checkingExisting, setCheckingExisting] = useState(false);
  const [existingApplication, setExistingApplication] = useState(null);

  // Check for existing application when email is provided
  useEffect(() => {
    if (emailParam) {
      checkExistingApplication();
    }
  }, [emailParam]);

  // Fetch case night configuration
  useEffect(() => {
    const fetchCaseNightConfig = async () => {
      try {
        const response = await axios.get("http://localhost:5002/api/applications/case-night-config");
        setCaseNightConfig(response.data);
      } catch (error) {
        console.error("Error fetching case night config:", error);
      }
    };
    fetchCaseNightConfig();
  }, []);

  const checkExistingApplication = async () => {
    setCheckingExisting(true);
    try {
      const response = await axios.get(`http://localhost:5002/api/applications/email/${emailParam}`);
      setExistingApplication(response.data);
    } catch (error) {
      // No existing application found, which is fine
      setExistingApplication(null);
    } finally {
      setCheckingExisting(false);
    }
  };

  const handleFileChange = (e, fieldName) => {
    setFormData({ ...formData, [fieldName]: e.target.files[0] });
  };

  const handleCaseNightChange = (slotId) => {
    setFormData({
      ...formData,
      caseNightPreferences: formData.caseNightPreferences.includes(slotId)
        ? formData.caseNightPreferences.filter(id => id !== slotId)
        : [...formData.caseNightPreferences, slotId]
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formDataToSend = new FormData();

    Object.keys(formData).forEach((key) => {
      formDataToSend.append(key, formData[key]);
    });

    try {
      await axios.post("http://localhost:5002/api/applications", formDataToSend, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      navigate("/success"); // ✅ Redirect to Success Page
    } catch (error) {
      alert("❌ Error submitting application.");
      console.error(error);
    }
  };

  if (checkingExisting) {
    return (
      <div style={{ textAlign: "center", padding: "24px", marginTop: "40px" }}>
        <div style={{
          border: "4px solid #e2e8f0",
          borderTop: "4px solid #3182ce",
          borderRadius: "50%",
          width: "40px",
          height: "40px",
          animation: "spin 1s linear infinite",
          margin: "0 auto 16px auto"
        }}></div>
        <p style={{ marginTop: "16px" }}>Checking for existing application...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (existingApplication) {
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
          backgroundColor: "white"
        }}>
          <div style={{
            backgroundColor: "#bee3f8",
            color: "#2b6cb0",
            padding: "12px",
            borderRadius: "6px",
            marginBottom: "16px",
            border: "1px solid #90cdf4"
          }}>
            ℹ️ You already have an application submitted for this email address.
          </div>
          
          <p style={{ fontSize: "18px", fontWeight: "bold", textAlign: "center", color: "black", margin: "0" }}>
            Application Status: {existingApplication.status}
          </p>
          
          <p style={{ fontSize: "16px", textAlign: "center", color: "#4a5568", margin: "0" }}>
            Email: {existingApplication.email}
          </p>
          
          <button 
            onClick={() => navigate(`/application/view?email=${existingApplication.email}`)}
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
            View & Edit My Application
          </button>
          
          <button 
            onClick={() => navigate("/")}
            style={{
              backgroundColor: "#718096",
              color: "white",
              border: "none",
              padding: "8px 16px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              width: "100%"
            }}
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

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
        backgroundColor: "white"
      }}>
        <h1 style={{ fontSize: "24px", fontWeight: "bold", textAlign: "center", color: "black", margin: "0" }}>
          APPLICATION - TCG WINTER 25 RECRUITMENT
        </h1>

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: "16px" }}>
            <p style={{ fontWeight: "bold", color: "#222", margin: "0 0 8px 0" }}>Email *</p>
            <input 
              type="email" 
              value={formData.email} 
              onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
              style={styles.input}
              required
            />
          </div>

          {/* Full Name */}
          <div style={{ marginBottom: "16px" }}>
            <p style={{ fontWeight: "bold", color: "#222", margin: "0 0 8px 0" }}>Full Name *</p>
            <input 
              type="text" 
              value={formData.fullName} 
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} 
              style={styles.input}
              required
            />
          </div>

          {/* Student Year */}
          <div style={{ marginBottom: "16px" }}>
            <p style={{ fontWeight: "bold", color: "#222", margin: "0 0 8px 0" }}>What year are you? *</p>
            <select 
              value={formData.studentYear} 
              onChange={(e) => setFormData({ ...formData, studentYear: e.target.value })} 
              style={styles.input}
              required
            >
              <option value="">Select your year</option>
              <option value="1st">1st Year</option>
              <option value="2nd">2nd Year</option>
              <option value="3rd">3rd Year</option>
              <option value="4th">4th Year</option>
              <option value="5th+">5th Year or More</option>
            </select>
          </div>

          {/* Major */}
          <div style={{ marginBottom: "16px" }}>
            <p style={{ fontWeight: "bold", color: "#222", margin: "0 0 8px 0" }}>What is your major? *</p>
            <input 
              type="text" 
              value={formData.major} 
              onChange={(e) => setFormData({ ...formData, major: e.target.value })} 
              style={styles.input}
              required
            />
          </div>

          {/* Have You Applied Before? */}
          <div style={{ marginBottom: "16px" }}>
            <p style={{ fontWeight: "bold", color: "#222", margin: "0 0 8px 0" }}>Have you applied to TCG before? *</p>
            <select 
              value={formData.appliedBefore}  
              onChange={(e) => setFormData({ ...formData, appliedBefore: e.target.value })}  
              style={styles.input}
              required
            >
              <option value="">Select an option</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>

          {/* Tech or Non-Tech */}
          <div style={{ marginBottom: "16px" }}>
            <p style={{ fontWeight: "bold", color: "#222", margin: "0 0 8px 0" }}>Are you Tech or Non-Tech? *</p>
            <select 
              value={formData.candidateType}  
              onChange={(e) => setFormData({ ...formData, candidateType: e.target.value })}  
              style={styles.input}
              required
            >
              <option value="">Select an option</option>
              <option value="Tech">Tech</option>
              <option value="Non-Tech">Non-Tech</option>
            </select>
          </div>

          {/* Resume Upload */}
          <div style={{ marginBottom: "16px" }}>
            <p style={{ fontWeight: "bold", color: "#222", margin: "0 0 8px 0" }}>Please submit your resume *</p>
            <input type="file" onChange={(e) => handleFileChange(e, "resume")} style={styles.fileInput} required />
          </div>

          {/* Transcript Upload */}
          <div style={{ marginBottom: "16px" }}>
            <p style={{ fontWeight: "bold", color: "#222", margin: "0 0 8px 0" }}>Please submit your transcript *</p>
            <input type="file" onChange={(e) => handleFileChange(e, "transcript")} style={styles.fileInput} required />
          </div>

          {/* Profile Picture Upload */}
          <div style={{ marginBottom: "16px" }}>
            <p style={{ fontWeight: "bold", color: "#222", margin: "0 0 8px 0" }}>Please upload a profile picture (JPG/PNG) *</p>
            <input 
              type="file" 
              accept="image/png, image/jpeg"  
              onChange={(e) => handleFileChange(e, "image")} 
              style={styles.fileInput} 
              required 
            />
          </div>

          {/* Why Join TCG? */}
          <div style={{ marginBottom: "16px" }}>
            <p style={{ fontWeight: "bold", color: "#222", margin: "0 0 8px 0" }}>Why do you want to join TCG? (250 words max) *</p>
            <textarea 
              value={formData.reason} 
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })} 
              style={styles.textarea}
              required
            />
          </div>

          {/* Case Night Availability */}
          {caseNightConfig && (
            <div style={{ marginBottom: "16px" }}>
              <p style={{ fontWeight: "bold", color: "#222", margin: "0 0 8px 0" }}>What is your availability for Case Night? *</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {Object.entries(caseNightConfig.slots).map(([slotId, timeSlot]) => (
                  <label key={slotId} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={formData.caseNightPreferences.includes(slotId)}
                      onChange={() => handleCaseNightChange(slotId)}
                      style={{ width: "16px", height: "16px" }}
                    />
                    <span style={{ color: "#222" }}>{timeSlot}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button 
            type="submit"
            style={{
              backgroundColor: "#3182ce",
              color: "white",
              border: "none",
              padding: "12px 24px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "16px",
              width: "100%",
              marginTop: "16px"
            }}
          >
            Submit Application
          </button>
        </form>
      </div>
    </div>
  );
};

// CSS Styles
const styles = {
  input: {
    width: "100%",
    padding: "12px",
    fontSize: "16px",
    borderRadius: "5px",
    border: "1px solid #ccc",
    backgroundColor: "#fff",
    color: "#222"
  },
  fileInput: {
    width: "100%",
    padding: "10px",
    fontSize: "16px",
    borderRadius: "5px",
    border: "1px solid #ccc",
    backgroundColor: "#fff",
    color: "#222"
  },
  textarea: {
    width: "100%",
    minHeight: "120px",
    padding: "12px",
    fontSize: "16px",
    borderRadius: "5px",
    border: "1px solid #ccc",
    backgroundColor: "#fff",
    color: "#222"
  }
};

export default ApplicationPage;
