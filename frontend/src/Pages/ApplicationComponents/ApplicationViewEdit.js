import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import axios from "axios";
import API_BASE_URL from "../../config/api";
import { 
  Box, 
  VStack, 
  Text, 
  Button, 
  Stack
} from "@chakra-ui/react";

// Helper function to get signed URL for file access
const getFileUrl = async (filePath) => {
  if (!filePath) return "";
  
  try {
    const response = await axios.get(`${API_BASE_URL}/api/applications/file-url/${encodeURIComponent(filePath)}`);
    return response.data.url;
  } catch (error) {
    console.error("Error getting file URL:", error);
    return filePath; // Fallback to original path
  }
};

const ApplicationViewEdit = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id } = useParams();
  const email = searchParams.get('email');
  const [currentUser, setCurrentUser] = useState(null);
  const auth = getAuth();
  
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [caseNightConfig, setCaseNightConfig] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false); // Auth state is now determined
    });
    return () => unsubscribe();
  }, [auth]);

  // Security check: Ensure user can only access their own application
  useEffect(() => {
    if (!authLoading) {
      // If user is not authenticated, redirect to home
      if (!currentUser) {
        console.log("User not authenticated, redirecting to home");
        navigate('/');
        return;
      }

      // If email parameter is provided, ensure it matches the authenticated user's email
      if (email && email !== currentUser.email) {
        console.log("Email parameter doesn't match authenticated user, redirecting to home");
        navigate('/');
        return;
      }
    }
  }, [authLoading, currentUser, email, navigate]);

  // Helper functions for word counting and validation
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

  const handleCaseNightChange = (slotId) => {
    const currentPrefs = formData.caseNightPreferences || [];
    setFormData({
      ...formData,
      caseNightPreferences: currentPrefs.includes(slotId)
        ? currentPrefs.filter(id => id !== slotId)
        : [...currentPrefs, slotId]
    });
  };

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

  // Fetch the application data with updated API endpoint
  const fetchApplication = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log("Fetching application with:", { id, email, currentUserEmail: currentUser?.email });
      console.log("Using API_BASE_URL:", API_BASE_URL);
      
      let applicationData;
      const token = process.env.REACT_APP_ADMIN_API_TOKEN || 'f8d9e3b7c2a1f6e4d5c8b9a3f7e2d1c0b5a9f3e7d2c6b1a8f4e9d3c7b2a1f';
      
      if (id) {
        console.log("Fetching by ID:", id);
        const response = await axios.get(`${API_BASE_URL}/api/applications/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        applicationData = response.data;
      } else if (email) {
        console.log("Fetching by email from query params:", email);
        const response = await axios.get(`${API_BASE_URL}/api/applications/email/${email}`);
        applicationData = response.data;
      } else if (currentUser?.email) {
        console.log("Fetching by current user email:", currentUser.email);
        const response = await axios.get(`${API_BASE_URL}/api/applications/email/${currentUser.email}`);
        applicationData = response.data;
      } else {
        throw new Error("No application identifier provided (need ID, email param, or logged-in user)");
      }

      console.log("Application data received:", applicationData);

      // Get signed URLs for files
      if (applicationData.resume) {
        applicationData.resumeUrl = await getFileUrl(applicationData.resume);
      }
      if (applicationData.transcript) {
        applicationData.transcriptUrl = await getFileUrl(applicationData.transcript);
      }
      if (applicationData.image) {
        applicationData.imageUrl = await getFileUrl(applicationData.image);
      }
      if (applicationData.additionalFiles) {
        applicationData.additionalFilesUrl = await getFileUrl(applicationData.additionalFiles);
      }

      console.log("Setting application data:", applicationData);
      setApplication(applicationData);
      setFormData(applicationData);
    } catch (error) {
      console.error("Error fetching application:", error);
      console.error("Error details:", error.response?.data);
      console.error("Error status:", error.response?.status);
      console.error("Full error object:", error);
      
      // If it's a 404 error (application not found), redirect to application creation page
      if (error.response?.status === 404) {
        console.log("Application not found, redirecting to application page");
        const userEmail = email || currentUser?.email;
        if (userEmail) {
          navigate(`/application?email=${encodeURIComponent(userEmail)}`);
        } else {
          navigate('/application');
        }
        return;
      }
      
      setError(error.response?.data?.message || error.message || "Failed to fetch application data");
    } finally {
      setLoading(false);
    }
  }, [id, email, currentUser?.email, navigate]);

  useEffect(() => {
    // Wait for auth to load, then fetch if we have an identifier
    if (!authLoading && (id || email || currentUser?.email)) {
      fetchApplication();
    } else if (!authLoading && !id && !email && !currentUser?.email) {
      // Auth is loaded but no identifier available
      setLoading(false);
      setError("No application identifier provided. Please log in or provide an email parameter.");
    }
  }, [authLoading, fetchApplication]);

  // Handle form field changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // Handle file uploads
  const handleFileChange = (e, fieldName) => {
    setFormData({ ...formData, [fieldName]: e.target.files[0] });
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Security check: Ensure user can only update their own application
    if (!currentUser) {
      alert("You must be logged in to update an application.");
      navigate('/');
      return;
    }

    if (application.email !== currentUser.email) {
      alert("You can only update your own application.");
      navigate('/');
      return;
    }
    
    try {
      setSubmitting(true);
      
      // Get Firebase auth token
      let authToken = null;
      if (currentUser) {
        try {
          authToken = await currentUser.getIdToken();
        } catch (tokenError) {
          console.error("Error getting auth token:", tokenError);
        }
      }
      
      const formDataToSubmit = new FormData();
      
      // Add all form fields to FormData
      Object.keys(formData).forEach(key => {
        if (formData[key] && key !== 'resumeUrl' && key !== 'transcriptUrl' && key !== 'imageUrl' && key !== 'additionalFilesUrl') {
          formDataToSubmit.append(key, formData[key]);
        }
      });

      // Prepare headers
      const headers = {
        'Content-Type': 'multipart/form-data',
      };
      
      // Add authorization header if we have a token
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      const response = await axios.put(`${API_BASE_URL}/api/applications/email/${application.email}`, formDataToSubmit, {
        headers,
      });

      if (response.status === 200) {
        // Smoothly transition back to view mode without popup
        await fetchApplication(); // Refresh the data
        setIsEditing(false);
        setSubmitting(false);
      }
    } catch (error) {
      alert("Error updating application: " + (error.response?.data?.message || error.message));
      console.error(error);
      setSubmitting(false);
    }
  };

  // Styles for form inputs
  const styles = {
    input: {
      width: "100%",
      padding: "12px",
      border: "1px solid #e2e8f0",
      borderRadius: "6px",
      fontSize: "16px",
      boxSizing: "border-box",
      backgroundColor: "white",
      color: "#2d3748"
    },
    textarea: {
      width: "100%",
      padding: "12px",
      border: "1px solid #e2e8f0",
      borderRadius: "6px",
      fontSize: "16px",
      boxSizing: "border-box",
      resize: "vertical",
      backgroundColor: "white",
      color: "#2d3748"
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
    }
  };

  // Basic loading state with matching styling
  if (loading || authLoading) {
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
          <p style={{ fontSize: "18px", margin: "0" }}>
            {authLoading ? "Checking authentication..." : "Loading your application..."}
          </p>
          <Box 
            width="40px" 
            height="40px" 
            border="4px solid #e2e8f0" 
            borderTop="4px solid #3182ce" 
            borderRadius="50%" 
            mx="auto"
            style={{
              animation: "spin 1s linear infinite"
            }}
          />
        </div>
      </div>
    );
  }

  // Error state with matching styling
  if (error) {
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
            backgroundColor: "#fed7d7",
            color: "#c53030",
            padding: "12px",
            borderRadius: "6px",
            marginBottom: "16px",
            border: "1px solid #fc8181"
          }}>
            ❌ {error}
          </div>
          
          {/* Debug info */}
          <div style={{
            backgroundColor: "#f7fafc",
            padding: "16px",
            borderRadius: "6px",
            fontSize: "14px",
            border: "1px solid #e2e8f0"
          }}>
            <p style={{ fontWeight: "bold", margin: "0 0 8px 0" }}>Debug Info:</p>
            <p style={{ margin: "0" }}>URL ID: {id || 'none'}</p>
            <p style={{ margin: "0" }}>Email param: {email || 'none'}</p>
            <p style={{ margin: "0" }}>Current user: {currentUser?.email || 'not logged in'}</p>
            <p style={{ margin: "0" }}>Auth loading: {authLoading.toString()}</p>
            <p style={{ margin: "0" }}>API Base URL: {API_BASE_URL}</p>
          </div>
          
          <button
            onClick={() => navigate("/application")}
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
            Create New Application
          </button>
        </div>
      </div>
    );
  }

  // No application found with matching styling
  if (!application) {
    console.log("Render: No application found state");
    console.log("Current state:", { 
      loading, 
      authLoading, 
      error, 
      application, 
      hasId: !!id, 
      hasEmail: !!email, 
      hasCurrentUser: !!currentUser?.email 
    });
    
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
          <p style={{ fontSize: "18px", margin: "0" }}>No application found</p>
          
          {/* Debug info */}
          <div style={{
            backgroundColor: "#f7fafc",
            padding: "16px",
            borderRadius: "6px",
            fontSize: "14px",
            border: "1px solid #e2e8f0",
            textAlign: "left"
          }}>
            <p style={{ fontWeight: "bold", margin: "0 0 8px 0" }}>Debug Info:</p>
            <p style={{ margin: "0" }}>Loading: {loading.toString()}</p>
            <p style={{ margin: "0" }}>Auth Loading: {authLoading.toString()}</p>
            <p style={{ margin: "0" }}>Error: {error || 'none'}</p>
            <p style={{ margin: "0" }}>Application: {application ? 'exists' : 'null'}</p>
            <p style={{ margin: "0" }}>URL ID: {id || 'none'}</p>
            <p style={{ margin: "0" }}>Email param: {email || 'none'}</p>
            <p style={{ margin: "0" }}>Current user: {currentUser?.email || 'not logged in'}</p>
            <p style={{ margin: "0" }}>API Base URL: {API_BASE_URL}</p>
          </div>
          
          <button
            onClick={() => navigate("/application")}
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
            Create New Application
          </button>
        </div>
      </div>
    );
  }

  if (!isEditing) {
    // View mode - show actual application details
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
          
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <p style={{ fontSize: "16px", color: "#4a5568", margin: "0" }}>
              Email: {application.email}
            </p>
          </div>

          {/* Application Details */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ fontWeight: "bold", display: "block", marginBottom: "4px" }}>Full Name:</label>
              <p style={{ margin: "0", padding: "8px", backgroundColor: "#f7fafc", borderRadius: "4px" }}>
                {application.fullName}
              </p>
            </div>

            <div>
              <label style={{ fontWeight: "bold", display: "block", marginBottom: "4px" }}>Student Year:</label>
              <p style={{ margin: "0", padding: "8px", backgroundColor: "#f7fafc", borderRadius: "4px" }}>
                {application.studentYear}
              </p>
            </div>

            <div>
              <label style={{ fontWeight: "bold", display: "block", marginBottom: "4px" }}>Major:</label>
              <p style={{ margin: "0", padding: "8px", backgroundColor: "#f7fafc", borderRadius: "4px" }}>
                {application.major}
              </p>
            </div>

            <div>
              <label style={{ fontWeight: "bold", display: "block", marginBottom: "4px" }}>Applied Before:</label>
              <p style={{ margin: "0", padding: "8px", backgroundColor: "#f7fafc", borderRadius: "4px" }}>
                {application.appliedBefore}
              </p>
            </div>

            <div>
              <label style={{ fontWeight: "bold", display: "block", marginBottom: "4px" }}>Candidate Type:</label>
              <p style={{ margin: "0", padding: "8px", backgroundColor: "#f7fafc", borderRadius: "4px" }}>
                {application.candidateType}
              </p>
            </div>

            <div>
              <label style={{ fontWeight: "bold", display: "block", marginBottom: "4px" }}>Why TCG? (150 words max):</label>
              <div style={{ margin: "0", padding: "8px", backgroundColor: "#f7fafc", borderRadius: "4px", whiteSpace: "pre-wrap" }}>
                {application.reason}
              </div>
            </div>

            <div>
              <label style={{ fontWeight: "bold", display: "block", marginBottom: "4px" }}>Zombie Apocalypse Answer (15 words max):</label>
              <div style={{ margin: "0", padding: "8px", backgroundColor: "#f7fafc", borderRadius: "4px", whiteSpace: "pre-wrap" }}>
                {application.zombieAnswer}
              </div>
            </div>

            {application.additionalInfo && (
              <div>
                <label style={{ fontWeight: "bold", display: "block", marginBottom: "4px" }}>Additional Information:</label>
                <div style={{ margin: "0", padding: "8px", backgroundColor: "#f7fafc", borderRadius: "4px", whiteSpace: "pre-wrap" }}>
                  {application.additionalInfo}
                </div>
              </div>
            )}

            {/* Files */}
            {application.resumeUrl && (
              <div>
                <label style={{ fontWeight: "bold", display: "block", marginBottom: "4px" }}>Resume:</label>
                <a 
                  href={application.resumeUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ 
                    color: "#3182ce", 
                    textDecoration: "underline",
                    display: "block",
                    padding: "8px",
                    backgroundColor: "#f7fafc",
                    borderRadius: "4px"
                  }}
                >
                  View Resume
                </a>
              </div>
            )}

            {application.transcriptUrl && (
              <div>
                <label style={{ fontWeight: "bold", display: "block", marginBottom: "4px" }}>Transcript:</label>
                <a 
                  href={application.transcriptUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ 
                    color: "#3182ce", 
                    textDecoration: "underline",
                    display: "block",
                    padding: "8px",
                    backgroundColor: "#f7fafc",
                    borderRadius: "4px"
                  }}
                >
                  View Transcript
                </a>
              </div>
            )}

            {application.imageUrl && (
              <div>
                <label style={{ fontWeight: "bold", display: "block", marginBottom: "4px" }}>Profile Picture:</label>
                <a 
                  href={application.imageUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ 
                    color: "#3182ce", 
                    textDecoration: "underline",
                    display: "block",
                    padding: "8px",
                    backgroundColor: "#f7fafc",
                    borderRadius: "4px"
                  }}
                >
                  View Profile Picture
                </a>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "20px" }}>
            <button 
              onClick={() => setIsEditing(true)}
              disabled={application.status === "Accepted" || application.status === "Rejected" || application.status === "Final Interview - Yes"}
              style={{
                backgroundColor: application.status === "Accepted" || application.status === "Rejected" || application.status === "Final Interview - Yes" ? "#a0a0a0" : "#3182ce",
                color: "white",
                border: "none",
                padding: "12px 24px",
                borderRadius: "6px",
                cursor: application.status === "Accepted" || application.status === "Rejected" || application.status === "Final Interview - Yes" ? "not-allowed" : "pointer",
                fontSize: "16px",
                width: "100%"
              }}
            >
              {application.status === "Accepted" || application.status === "Rejected" || application.status === "Final Interview - Yes" ? "Application Locked" : "Edit Application"}
            </button>
            
            <button 
              onClick={() => navigate("/application")}
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
              Back to Application Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Edit mode with matching ApplicationPage styling
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

        {/* Application Status Header - same as view mode */}
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <p style={{ fontSize: "16px", color: "#4a5568", margin: "0" }}>
            Email: {application.email}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Email (read-only) */}
          <div>
            <label style={{ fontSize: "16px", fontWeight: "bold", color: "#2d3748", display: "block", marginBottom: "8px" }}>
              Email *
            </label>
            <input 
              type="email" 
              value={formData.email || ''} 
              disabled
              style={{...styles.input, backgroundColor: "#f7fafc", color: "#4a5568", opacity: 1}}
            />
          </div>

          {/* Full Name */}
          <div>
            <label style={{ fontSize: "16px", fontWeight: "bold", color: "#2d3748", display: "block", marginBottom: "8px" }}>
              Full Name *
            </label>
            <input 
              type="text" 
              name="fullName"
              value={formData.fullName || ''} 
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} 
              style={styles.input}
              required
            />
          </div>

          {/* Student Year */}
          <div>
            <label style={{ fontSize: "16px", fontWeight: "bold", color: "#2d3748", display: "block", marginBottom: "8px" }}>
              What year are you? *
            </label>
            <select 
              name="studentYear"
              value={formData.studentYear || ''} 
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
          <div>
            <label style={{ fontSize: "16px", fontWeight: "bold", color: "#2d3748", display: "block", marginBottom: "8px" }}>
              What is your major? *
            </label>
            <input 
              type="text" 
              name="major"
              value={formData.major || ''} 
              onChange={(e) => setFormData({ ...formData, major: e.target.value })} 
              style={styles.input}
              required
            />
          </div>

          {/* Applied Before */}
          <div>
            <label style={{ fontSize: "16px", fontWeight: "bold", color: "#2d3748", display: "block", marginBottom: "8px" }}>
              Have you applied to TCG before? *
            </label>
            <select 
              name="appliedBefore"
              value={formData.appliedBefore || ''} 
              onChange={handleInputChange} 
              style={styles.input}
              required
            >
              <option value="">Select an option</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>

          {/* Candidate Type */}
          <div>
            <label style={{ fontSize: "16px", fontWeight: "bold", color: "#2d3748", display: "block", marginBottom: "8px" }}>
              Are you applying as a tech candidate or non-tech candidate? *
            </label>
            <select 
              name="candidateType"
              value={formData.candidateType || ''} 
              onChange={handleInputChange} 
              style={styles.input}
              required
            >
              <option value="">Select an option</option>
              <option value="Tech">Tech</option>
              <option value="Non-Tech">Non-Tech</option>
            </select>
          </div>

          {/* Reason */}
          <div>
            <label style={{ fontSize: "16px", fontWeight: "bold", color: "#2d3748", display: "block", marginBottom: "8px" }}>
              Why do you want to join TCG? (150 words max) *
            </label>
            <textarea 
              name="reason"
              value={formData.reason || ''} 
              onChange={handleReasonChange} 
              style={styles.textarea}
              rows="5"
              required
            />
            <div style={{ textAlign: "right", fontSize: "12px", color: "#666", marginTop: "4px" }}>
              {countWords(formData.reason || '')}/150 words
            </div>
          </div>

          {/* Resume Upload */}
          <div>
            <label style={{ fontSize: "16px", fontWeight: "bold", color: "#2d3748", display: "block", marginBottom: "8px" }}>
              Please submit your resume *
            </label>
            <input 
              type="file" 
              onChange={(e) => handleFileChange(e, "resume")} 
              style={styles.fileInput}
              accept=".pdf,.doc,.docx"
            />
          </div>

          {/* Transcript Upload */}
          <div>
            <label style={{ fontSize: "16px", fontWeight: "bold", color: "#2d3748", display: "block", marginBottom: "8px" }}>
              Please submit your transcript *
            </label>
            <input 
              type="file" 
              onChange={(e) => handleFileChange(e, "transcript")} 
              style={styles.fileInput}
              accept=".pdf,.doc,.docx"
            />
          </div>

          {/* Profile Picture Upload */}
          <div>
            <label style={{ fontSize: "16px", fontWeight: "bold", color: "#2d3748", display: "block", marginBottom: "8px" }}>
              Please upload a profile picture (JPG/PNG) *
            </label>
            <input 
              type="file" 
              accept="image/png, image/jpeg"
              onChange={(e) => handleFileChange(e, "image")} 
              style={styles.fileInput}
            />
          </div>

          {/* Fun Question - Zombie Apocalypse */}
          <div>
            <label style={{ fontSize: "16px", fontWeight: "bold", color: "#2d3748", display: "block", marginBottom: "8px" }}>
              How are you surviving the zombie apocalypse? (15 words) *
            </label>
            <textarea
              name="zombieAnswer"
              value={formData.zombieAnswer || ''}
              onChange={handleZombieChange}
              style={styles.textarea}
              rows="3"
              required
            />
            <div style={{ textAlign: "right", fontSize: "12px", color: "#666", marginTop: "4px" }}>
              {countWords(formData.zombieAnswer || '')}/15 words
            </div>
          </div>

          {/* Additional Info - Optional */}
          <div>
            <label style={{ fontSize: "16px", fontWeight: "bold", color: "#2d3748", display: "block", marginBottom: "8px" }}>
              Is there anything else that you think you should let us know?
            </label>
            <textarea
              name="additionalInfo"
              value={formData.additionalInfo || ''}
              onChange={(e) => setFormData({ ...formData, additionalInfo: e.target.value })}
              style={styles.textarea}
              rows="4"
            />
          </div>

          {/* Case Night Availability */}
          {caseNightConfig && (
            <div>
              <label style={{ fontSize: "16px", fontWeight: "bold", color: "#2d3748", display: "block", marginBottom: "8px" }}>
                What is your availability for Case Night? *
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {Object.entries(caseNightConfig.slots).map(([slotId, timeSlot]) => (
                  <label key={slotId} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={(formData.caseNightPreferences || []).includes(slotId)}
                      onChange={() => handleCaseNightChange(slotId)}
                      style={{ width: "16px", height: "16px" }}
                    />
                    <span style={{ color: "#2d3748" }}>{timeSlot}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              backgroundColor: submitting ? "#a0a0a0" : "#3182ce",
              color: "white",
              border: "none",
              padding: "12px 24px",
              borderRadius: "6px",
              cursor: submitting ? "not-allowed" : "pointer",
              fontSize: "16px",
              width: "100%",
              marginTop: "8px"
            }}
          >
            {submitting ? "Updating..." : "Update Application"}
          </button>
          
          <button
            type="button"
            onClick={() => setIsEditing(false)}
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
            Cancel Edit
          </button>
        </form>
      </div>
    </div>
  );
};

export default ApplicationViewEdit;
