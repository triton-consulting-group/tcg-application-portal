import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";

 // ✅ Import useNavigate for redirection
import axios from "axios";
import API_BASE_URL from "../config/api";

const ApplicationPage = () => {
  const navigate = useNavigate(); // ✅ Initialize useNavigate
  const [searchParams] = useSearchParams();
  const { id } = useParams(); // ✅ Get ID from URL params
  const emailParam = searchParams.get('email');
  const [currentUser, setCurrentUser] = useState(null);
  const auth = getAuth();

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
    zombieAnswer: "",
    additionalInfo: "",
    caseNightPreferences: []
  });

  const [caseNightConfig, setCaseNightConfig] = useState(null);
  const [deadlineStatus, setDeadlineStatus] = useState(null);

  const [checkingExisting, setCheckingExisting] = useState(false);
  const [existingApplication, setExistingApplication] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Track authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false); // Auth state is now determined
    });
    return () => unsubscribe();
  }, [auth]);

  // Authentication guard - redirect if not authenticated
  useEffect(() => {
    if (authLoading) {
      // Still loading auth state
      return;
    }
    
    if (!currentUser) {
      // User is not authenticated, redirect to home
      navigate('/', { replace: true });
      return;
    }

    // If URL has email param, verify it matches authenticated user
    if (emailParam && emailParam !== currentUser.email) {
      // User is trying to access someone else's application
      alert("You can only access your own application.");
      navigate('/', { replace: true });
      return;
    }
  }, [authLoading, currentUser, emailParam, navigate]);

  // Update form data when user logs in (if no email param provided)
  useEffect(() => {
    if (!emailParam && currentUser && currentUser.email) {
      setFormData(prev => ({ ...prev, email: currentUser.email }));
    }
  }, [currentUser, emailParam]);

  // Check for existing application when ID, email is provided, or user is logged in
  useEffect(() => {
    // Wait for auth to complete before checking applications
    if (authLoading) return;
    
    if (id) {
      // If we have an ID, fetch application by ID
      fetchApplicationById(id);
    } else {
      // Otherwise, use email-based lookup
      const emailToCheck = emailParam || (currentUser && currentUser.email);
      if (emailToCheck) {
        checkExistingApplication(emailToCheck);
      }
    }
  }, [id, emailParam, currentUser, authLoading]);

  // Fetch case night configuration
  useEffect(() => {
    const fetchCaseNightConfig = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/applications/case-night-config`);
        setCaseNightConfig(response.data);
      } catch (error) {
        console.error("Error fetching case night config:", error);
      }
    };
    fetchCaseNightConfig();
  }, []);

  // Fetch deadline status
  useEffect(() => {
    const fetchDeadlineStatus = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/applications/deadline-status`);
        setDeadlineStatus(response.data);
      } catch (error) {
        console.error("Error fetching deadline status:", error);
      }
    };
    fetchDeadlineStatus();
  }, []);

  const fetchApplicationById = async (applicationId) => {
    setCheckingExisting(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/applications/${applicationId}`);
      
      // Security check: Ensure user can only access their own application
      if (!currentUser) {
        console.log("User not authenticated, cannot access application by ID");
        navigate('/');
        return;
      }

      if (response.data.email !== currentUser.email) {
        console.log("Application doesn't belong to authenticated user, redirecting to home");
        navigate('/');
        return;
      }

      setExistingApplication(response.data);
      // Pre-populate form with existing data
      setFormData({
        email: response.data.email,
        fullName: response.data.fullName,
        studentYear: response.data.studentYear,
        major: response.data.major,
        appliedBefore: response.data.appliedBefore,
        candidateType: response.data.candidateType,
        reason: response.data.reason,
        zombieAnswer: response.data.zombieAnswer,
        additionalInfo: response.data.additionalInfo,
        caseNightPreferences: response.data.caseNightPreferences || [],
        resume: null,
        transcript: null,
        image: null
      });
    } catch (error) {
      console.error("Error fetching application by ID:", error);
      setExistingApplication(null);
    } finally {
      setCheckingExisting(false);
    }
  };

  const checkExistingApplication = async (email) => {
    setCheckingExisting(true);
    try {
      const emailToUse = email || emailParam;
      const response = await axios.get(`${API_BASE_URL}/api/applications/email/${emailToUse}`);
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

  // Helpers to enforce word limits
  const countWords = (text) => (text || "").trim().split(/\s+/).filter(Boolean).length;
  const handleReasonChange = (e) => {
    const value = e.target.value;
    const words = value.trim().split(/\s+/).filter(Boolean);
    if (words.length <= 150) {
      setFormData({ ...formData, reason: value });
    } else {
      setFormData({ ...formData, reason: words.slice(0, 150).join(" ") });
    }
  };
  const handleZombieChange = (e) => {
    const value = e.target.value;
    const words = value.trim().split(/\s+/).filter(Boolean);
    if (words.length <= 15) {
      setFormData({ ...formData, zombieAnswer: value });
    } else {
      setFormData({ ...formData, zombieAnswer: words.slice(0, 15).join(" ") });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Authentication check
    if (!currentUser) {
      alert("You must be signed in to submit an application.");
      navigate('/', { replace: true });
      return;
    }

    // Verify the form email matches the authenticated user
    if (formData.email !== currentUser.email) {
      alert("You can only submit applications for your own email address.");
      return;
    }
    
    // Check deadline before submission
    if (deadlineStatus && deadlineStatus.isDeadlinePassed) {
      alert(deadlineStatus.message || "Applications are now closed.");
      return;
    }
    
    setSubmitting(true); // Start loading
    
    const formDataToSend = new FormData();

    Object.keys(formData).forEach((key) => {
      formDataToSend.append(key, formData[key]);
    });

    try {
      console.log("Submitting application...");
      const response = await axios.post(`${API_BASE_URL}/api/applications`, formDataToSend, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      console.log("Application submitted successfully:", response.status);
      
      // Redirect immediately after successful submission
      navigate("/application-submitted", { replace: true });
    } catch (error) {
      setSubmitting(false); // Stop loading on error
      console.error("Application submission error:", error);
      
      // Check for specific error types and messages
      if (error.response?.data?.error) {
        // Backend returned a structured error message
        alert(error.response.data.error);
      } else if (error.response?.data?.message) {
        // Alternative message field
        alert(error.response.data.message);
      } else if (error.response?.status === 413) {
        // File too large
        alert("File size too large. Please choose smaller files and try again.");
      } else if (error.response?.status >= 500) {
        // Server error
        alert("Server error occurred. Please try again later.");
      } else if (error.code === 'NETWORK_ERROR' || !error.response) {
        // Network connectivity issue
        alert("Network error. Please check your connection and try again.");
      } else {
        // Generic fallback with more helpful message
        alert("Error submitting application. Please check your files and try again.");
      }
    }
  };

  // Show loading while checking authentication
  if (authLoading) {
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
        <p style={{ marginTop: "16px" }}>Checking authentication...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

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
          maxWidth: "700px",
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
            onClick={() => navigate(`/application/view?email=${encodeURIComponent(existingApplication.email)}`)}
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
        maxWidth: "700px",
        margin: "40px auto 0 auto",
        padding: "24px",
        borderRadius: "8px",
        boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
        backgroundColor: "white"
      }}>
        <h1 style={{ fontSize: "24px", fontWeight: "bold", textAlign: "center", color: "black", margin: "0" }}>
          APPLICATION - TCG FALL 25 RECRUITMENT
        </h1>

        {/* Deadline Status Display */}
        {deadlineStatus && deadlineStatus.isDeadlinePassed && (
          <div style={{
            backgroundColor: "#fed7d7",
            color: "#c53030",
            padding: "16px",
            borderRadius: "8px",
            marginBottom: "20px",
            border: "2px solid #feb2b2",
            textAlign: "center"
          }}>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "20px" }}>Applications Closed</h2>
            <p style={{ margin: "0", fontSize: "16px" }}>
              {deadlineStatus.message || "Thank you for your interest in TCG!"}
            </p>
          </div>
        )}

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
            <p style={{ fontWeight: "bold", color: "#222", margin: "0 0 8px 0" }}>Are you applying as a tech candidate or non-tech candidate?*</p>
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
            <input 
              type="file" 
              onChange={(e) => handleFileChange(e, "resume")} 
              style={styles.fileInput}
              accept=".pdf,.doc,.docx"
              required
            />
          </div>

          {/* Transcript Upload */}
          <div style={{ marginBottom: "16px" }}>
            <p style={{ fontWeight: "bold", color: "#222", margin: "0 0 8px 0" }}>Please submit your transcript *</p>
            <input 
              type="file" 
              onChange={(e) => handleFileChange(e, "transcript")} 
              style={styles.fileInput}
              accept=".pdf,.doc,.docx"
              required
            />
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
            <p style={{ fontWeight: "bold", color: "#222", margin: "0 0 8px 0" }}>Why do you want to join TCG? (150 words max) *</p>
            <textarea 
              value={formData.reason} 
              onChange={handleReasonChange}
              style={styles.textarea}
              required
            />
            <div style={{ textAlign: "right", fontSize: "12px", color: "#666", marginTop: "4px" }}>
              {countWords(formData.reason)}/150 words
            </div>
          </div>

          {/* Fun Question - Zombie Apocalypse */}
          <div style={{ marginBottom: "16px" }}>
            <p style={{ fontWeight: "bold", color: "#222", margin: "0 0 8px 0" }}>How are you surviving the zombie apocalypse? (15 words) *</p>
            <textarea
              value={formData.zombieAnswer}
              onChange={handleZombieChange}
              style={styles.textarea}
              required
            />
            <div style={{ textAlign: "right", fontSize: "12px", color: "#666", marginTop: "4px" }}>
              {countWords(formData.zombieAnswer)}/15 words
            </div>
          </div>

          {/* Additional Info - Optional */}
          <div style={{ marginBottom: "16px" }}>
            <p style={{ fontWeight: "bold", color: "#222", margin: "0 0 8px 0" }}>Is there anything else that you think you should let us know?</p>
            <textarea
              value={formData.additionalInfo}
              onChange={(e) => setFormData({ ...formData, additionalInfo: e.target.value })}
              style={styles.textarea}
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
            disabled={deadlineStatus && deadlineStatus.isDeadlinePassed || submitting}
            style={{
              backgroundColor: deadlineStatus && deadlineStatus.isDeadlinePassed || submitting ? "#a0aec0" : "#3182ce",
              color: "white",
              border: "none",
              padding: "12px 24px",
              borderRadius: "6px",
              cursor: deadlineStatus && deadlineStatus.isDeadlinePassed || submitting ? "not-allowed" : "pointer",
              fontSize: "16px",
              width: "100%",
              marginTop: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px"
            }}
          >
            {submitting && (
              <div style={{
                width: "16px",
                height: "16px",
                border: "2px solid transparent",
                borderTop: "2px solid white",
                borderRadius: "50%",
                animation: "spin 1s linear infinite"
              }} />
            )}
            {submitting 
              ? "Submitting..." 
              : deadlineStatus && deadlineStatus.isDeadlinePassed 
                ? "Applications Closed" 
                : "Submit Application"
            }
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
    padding: "12px 16px",
    border: "2px dashed #cbd5e0",
    borderRadius: "8px",
    fontSize: "14px",
    boxSizing: "border-box",
    backgroundColor: "#f7fafc",
    cursor: "pointer",
    transition: "all 0.2s ease-in-out",
    color: "#4a5568"
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
