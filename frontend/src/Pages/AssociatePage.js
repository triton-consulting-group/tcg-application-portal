import React, { useState, useMemo, useEffect, useCallback } from "react";
import axios from "axios";
import "./associatePage.css";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./Home/firebaseConfig";
import API_BASE_URL from "../config/api";

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

const AssociatePage = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "ascending",
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [adminInfo, setAdminInfo] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [applicationsPerPage] = useState(30);
  const [exporting, setExporting] = useState(false);
  const [caseNightConfig, setCaseNightConfig] = useState(null);

  const checkAdminStatus = useCallback(async (email) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/admin/check`, { email });
      if (response.data.isAdmin) {
        setIsAdmin(true);
        setAdminInfo(response.data.admin);
        localStorage.setItem("adminEmail", email);
        fetchApplications();
      } else {
        setIsAdmin(false);
        setError("Access denied. Admin privileges required.");
        setLoading(false);
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
      setIsAdmin(false);
      setError("Access denied. Admin privileges required.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check authentication state
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        checkAdminStatus(user.email);
      } else {
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [checkAdminStatus]);

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

  const fetchApplications = async () => {
    try {
      // Use the backward-compatible endpoint to get all applications
      const response = await axios.get(`${API_BASE_URL}/api/applications/all`);
      setApplications(response.data || []);
      setLoading(false);
    } catch (error) {
      console.error("❌ Error fetching applications:", error);
      setError("Failed to fetch applications.");
      setLoading(false);
    }
  };

  const requestSort = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const sortedApplications = useMemo(() => {
    let sortableItems = [...applications];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key])
          return sortConfig.direction === "ascending" ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key])
          return sortConfig.direction === "ascending" ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [applications, sortConfig]);

  const filteredApplications = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return sortedApplications.filter((app) =>
      ["fullName", "major", "email"].some((key) =>
        app[key]?.toLowerCase().includes(lowerSearchTerm)
      )
    );
  }, [searchTerm, sortedApplications]);

  // Pagination logic
  const indexOfLastApplication = currentPage * applicationsPerPage;
  const indexOfFirstApplication = indexOfLastApplication - applicationsPerPage;
  const currentApplications = filteredApplications.slice(indexOfFirstApplication, indexOfLastApplication);
  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / applicationsPerPage));

  // Reset to first page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handleExportCaseGroups = async () => {
    setExporting(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/case-groups/export`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `case-group-assignments-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      alert("Case group assignments exported successfully!");
    } catch (error) {
      console.error("Error exporting case groups:", error);
      alert("Failed to export case groups. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const updateStatus = (applicationId, newStatus, notes = "") => {
    // Debug: Log admin permissions
    console.log("🔍 Admin info:", adminInfo);
    console.log("🔍 Admin role:", adminInfo?.role);
    console.log("🔍 Admin permissions:", adminInfo?.permissions);
    console.log("🔍 Can change status:", adminInfo?.permissions?.canChangeStatus);
    
    // Check if admin has permission to change status
    // Super admins always have permission, regular admins need explicit permission
    const hasPermission = adminInfo?.role === "super_admin" || adminInfo?.permissions?.canChangeStatus;
    
    if (!hasPermission) {
      alert("❌ You don't have permission to change application status.");
      return;
    }

    const adminEmail = localStorage.getItem("adminEmail") || currentUser?.email || "Unknown Admin";
    
    axios
      .put(`${API_BASE_URL}/api/applications/${applicationId}`, {
        status: newStatus,
        changedBy: adminEmail,
        notes: notes
      }, {
        headers: {
          'x-admin-email': adminEmail
        }
      })
      .then(() => {
        return axios.get(`${API_BASE_URL}/api/applications/all`); // 🔹 Refetch all applications
      })
      .then((response) => {
        setApplications(response.data || []);
        console.log(`✅ Successfully updated application ${applicationId} status to ${newStatus}`);
      })
      .catch((error) => {
        console.error("❌ Error updating status:", error);
        if (error.response?.data?.error) {
          alert(`❌ Failed to update status: ${error.response.data.error}`);
        } else {
          alert("❌ Failed to update application status. Please try again.");
        }
      });
  };

  if (loading) return <p>Loading applications...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!isAdmin) return <p style={{ color: "red" }}>Access denied. Admin privileges required.</p>;

  return (
    <div className="associate-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1>Triton Consulting Group - Associate Portal</h1>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: "0", fontSize: "14px" }}>
            Welcome, {adminInfo?.name || currentUser?.displayName} ({adminInfo?.role || "Admin"})
          </p>
          <div style={{ display: "flex", gap: "8px", marginTop: "5px" }}>
            <button 
              onClick={handleExportCaseGroups}
              disabled={exporting}
              style={{
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                padding: "8px 16px",
                borderRadius: "4px",
                cursor: exporting ? "not-allowed" : "pointer",
                fontSize: "14px",
                opacity: exporting ? 0.6 : 1
              }}
            >
              {exporting ? "Exporting..." : "Export Case Groups"}
            </button>
            <button 
              onClick={fetchApplications}
              style={{
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                padding: "8px 16px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px"
              }}
            >
              Refresh Data
            </button>
            {adminInfo?.permissions?.canManageAdmins && (
              <button 
                onClick={() => window.location.href = "/admin"}
                style={{
                  backgroundColor: "#28a745",
                  color: "white",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "14px"
                }}
              >
                Manage Admins
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="tab-container">
        <div className="tabs">
          <button
            className={selectedTab === 0 ? "active" : ""}
            onClick={() => setSelectedTab(0)}
          >
            All Applications
          </button>
          <button
            className={selectedTab === 1 ? "active" : ""}
            onClick={() => setSelectedTab(1)}
          >
            Application Phases
          </button>
        </div>

        {selectedTab === 0 ? (
          <TableView
            applications={currentApplications}
            setSelectedApplication={setSelectedApplication}
            requestSort={requestSort}
            sortConfig={sortConfig}
            updateStatus={updateStatus}
            setSearchTerm={setSearchTerm}
            setSelectedImage={setSelectedImage}
            currentPage={currentPage}
            totalPages={totalPages}
            totalApplications={filteredApplications.length}
            applicationsPerPage={applicationsPerPage}
            onPageChange={handlePageChange}
            adminInfo={adminInfo}
          />
        ) : (
          <PhasesView
            applications={applications}
            setSelectedApplication={setSelectedApplication}
            setApplications={setApplications}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            adminInfo={adminInfo}
          />
        )}
      </div>

      {selectedApplication && (
        <ApplicationDetail
          application={selectedApplication}
          onClose={() => setSelectedApplication(null)}
          updateStatus={updateStatus}
          caseNightConfig={caseNightConfig}
          adminInfo={adminInfo}
        />
      )}

      {selectedImage && (
        <ImageModal
          imageUrl={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
};

// 🟢 **TableView Component**
const TableView = ({
  applications,
  setSelectedApplication,
  requestSort,
  sortConfig,
  updateStatus,
  setSearchTerm,
  setSelectedImage,
  currentPage,
  totalPages,
  totalApplications,
  applicationsPerPage,
  onPageChange,
  adminInfo,
}) => (
  <div className="all-applications">
    <div className="search-bar">
      <input
        type="text"
        placeholder="Search by name, major, or email..."
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{
          backgroundColor: "white",
          color: "#333",
          border: "1px solid #ccc",
          borderRadius: "5px",
          padding: "12px",
          fontSize: "14px",
          outline: "none",
          width: "100%",
          maxWidth: "500px"
        }}
        onFocus={(e) => {
          e.target.style.borderColor = "#007bff";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = "#ccc";
        }}
      />
    </div>
    <table>
      <thead>
        <tr>
          <th>Email</th>
          <th>Full Name</th>
          <th>Student Year</th>
          <th>Major</th>
          <th>Applied Before?</th>
          <th>Track</th>
          <th>Resume</th>
          <th>Transcript</th>
          <th>Profile Picture</th>
          <th>Reason for Applying</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {applications.map((app) => (
          <tr 
            key={app._id}
            className="clickable-row"
            onClick={() => setSelectedApplication(app)}
          >
            <td>{app.email}</td>
            <td>{app.fullName}</td>
            <td>{app.studentYear}</td>
            <td>{app.major}</td>
            <td>{app.appliedBefore}</td>
            <td>{app.candidateType}</td>
            <td>
              <a
                href="#"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const url = await getFileUrl(app.resume);
                  if (url) window.open(url, '_blank');
                }}
              >
                View Resume
              </a>
            </td>
            <td>
              <a
                href="#"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const url = await getFileUrl(app.transcript);
                  if (url) window.open(url, '_blank');
                }}
              >
                View Transcript
              </a>
            </td>
            <td>
              <img
                src={app.image || "/default-profile.png"}
                alt="Profile"
                width="50"
                height="50"
                onClick={async (e) => {
                  e.stopPropagation();
                  if (app.image) {
                    const url = await getFileUrl(app.image);
                    if (url) setSelectedImage(url);
                  }
                }}
                style={{ 
                  cursor: app.image ? "pointer" : "default",
                  borderRadius: "4px",
                  objectFit: "cover"
                }}
              />
            </td>
            <td>
              {app.reason.length > 30
                ? `${app.reason.substring(0, 30)}...`
                : app.reason}
            </td>

            <td>
              <select
                value={app.status}
                onChange={(e) => updateStatus(app._id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                disabled={!(adminInfo?.role === "super_admin" || adminInfo?.permissions?.canChangeStatus)}
                style={{
                  opacity: (adminInfo?.role === "super_admin" || adminInfo?.permissions?.canChangeStatus) ? 1 : 0.6,
                  cursor: (adminInfo?.role === "super_admin" || adminInfo?.permissions?.canChangeStatus) ? "pointer" : "not-allowed"
                }}
              >
                <option value="Under Review">Under Review</option>
                <option value="Case Night - Yes">Case Night - Yes</option>
                <option value="Case Night - No">Case Night - No</option>
                <option value="Final Interview - Yes">Final Interview - Yes</option>
                <option value="Final Interview - No">Final Interview - No</option>
                <option value="Final Interview - Maybe">Final Interview - Maybe</option>
                <option value="Accepted">Accepted</option>
                <option value="Rejected">Rejected</option>
              </select>
            </td>

            <td>
              <button
                className="view-button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedApplication(app);
                }}
              >
                View Application
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    
    {/* Pagination Component */}
    {totalApplications > 0 && (
      <div className="pagination-container">
        <div className="pagination-info">
          Showing {((currentPage - 1) * applicationsPerPage) + 1} to {Math.min(currentPage * applicationsPerPage, totalApplications)} of {totalApplications} applications
        </div>
        
        <div className="pagination-controls">
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className="pagination-button"
            title="Go to first page"
          >
            First
          </button>
          
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="pagination-button"
          >
            Previous
          </button>
          
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNumber;
            if (totalPages <= 5) {
              pageNumber = i + 1;
            } else if (currentPage <= 3) {
              pageNumber = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNumber = totalPages - 4 + i;
            } else {
              pageNumber = currentPage - 2 + i;
            }
            
            return (
              <button
                key={pageNumber}
                onClick={() => onPageChange(pageNumber)}
                className={`pagination-button page-number ${currentPage === pageNumber ? 'active' : ''}`}
              >
                {pageNumber}
              </button>
            );
          })}
          
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="pagination-button"
          >
            Next
          </button>
          
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="pagination-button"
            title="Go to last page"
          >
            Last
          </button>
        </div>
      </div>
    )}
  </div>
);

// 🟢 **Image Modal Component**
const ImageModal = ({ imageUrl, onClose }) => (
  <div className="modal-overlay">
    <div className="modal-content">
      <button className="close-button" onClick={onClose}>
        ×
      </button>
      <img
        src={imageUrl}
        alt="Enlarged Profile"
        style={{ width: "100%", height: "auto" }}
      />
    </div>
  </div>
);

// 🟢 **ApplicationDetail Component (Updated)**
const ApplicationDetail = ({ application, onClose, caseNightConfig, adminInfo }) => {
  const [comments, setComments] = useState(application.comments || []);
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);

  // Load the image URL when component mounts
  useEffect(() => {
    const loadImageUrl = async () => {
      if (application.image) {
        try {
          const url = await getFileUrl(application.image);
          setImageUrl(url);
        } catch (error) {
          console.error("Error loading image URL:", error);
          setImageUrl(null);
        }
      }
    };
    loadImageUrl();
  }, [application.image]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    
    // Check if admin has permission to add comments
    if (!adminInfo?.permissions?.canAddComments) {
      alert("❌ You don't have permission to add comments.");
      return;
    }
    
    setIsSubmittingComment(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/applications/${application._id}/comment`, {
        comment: newComment,
        adminEmail: adminInfo?.email || "unknown@admin.com",
        adminName: adminInfo?.name || "Unknown Admin"
      }, {
        headers: {
          'x-admin-email': adminInfo?.email || "unknown@admin.com"
        }
      });

      if (response.data) {
        setComments(prev => [...prev, response.data.comment]);
        setNewComment("");
      }
    } catch (error) {
      console.error("Error adding comment:", error);
      alert("Failed to add comment. Please try again.");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
  <div className="modal-overlay">
    <div className="modal-content" style={{ maxWidth: "800px", maxHeight: "90vh", overflowY: "auto" }}>
      <button className="close-button" onClick={onClose}>
        ×
      </button>
      <h2>{application.fullName}'s Application</h2>
      
      <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
        <div style={{ flex: 1 }}>
          <img
            src={imageUrl || "/default-profile.png"}
            alt="Profile"
            width="100"
            height="100"
            style={{ borderRadius: "8px" }}
          />
          <p>
            <strong>Email:</strong> {application.email}
          </p>
          <p>
            <strong>Year:</strong> {application.studentYear}
          </p>
          <p>
            <strong>Major:</strong> {application.major}
          </p>
          <p>
            <strong>Track:</strong> {application.candidateType}
          </p>
          <p>
            <strong>Current Status:</strong> 
            <span style={{
              backgroundColor: "#28a745",
              color: "white",
              padding: "4px 8px",
              borderRadius: "4px",
              marginLeft: "8px",
              fontSize: "12px"
            }}>
              {application.status}
            </span>
          </p>
          
          {/* Case Night Availability Section */}
          {application.caseNightPreferences && application.caseNightPreferences.length > 0 && (
            <div style={{ marginTop: "15px" }}>
              <p>
                <strong>Case Night Availability:</strong>
              </p>
              <div style={{
                backgroundColor: "#e3f2fd",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #bbdefb"
              }}>
                {application.caseNightPreferences.map((slot, index) => {
                  const slotName = caseNightConfig?.slots?.[slot] || `Slot ${slot}`;
                  return (
                    <span
                      key={slot}
                      style={{
                        backgroundColor: "#1976d2",
                        color: "white",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        marginRight: "8px",
                        marginBottom: "4px",
                        display: "inline-block"
                      }}
                    >
                      {slotName}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        
        <div style={{ flex: 1 }}>
          <p>
            <strong>Reason for Applying:</strong>
          </p>
          <div style={{
            backgroundColor: "#f8f9fa",
            padding: "12px",
            borderRadius: "6px",
            maxHeight: "150px",
            overflowY: "auto"
          }}>
            {application.reason}
          </div>
          
          {/* Zombie Apocalypse Question */}
          {application.zombieAnswer && (
            <div style={{ marginTop: "15px" }}>
              <p>
                <strong>How are you surviving the zombie apocalypse?</strong>
              </p>
              <div style={{
                backgroundColor: "#f8f9fa",
                padding: "12px",
                borderRadius: "6px",
                maxHeight: "100px",
                overflowY: "auto"
              }}>
                {application.zombieAnswer}
              </div>
            </div>
          )}
          
          {/* Additional Info Question */}
          {application.additionalInfo && (
            <div style={{ marginTop: "15px" }}>
              <p>
                <strong>Additional Information:</strong>
              </p>
              <div style={{
                backgroundColor: "#f8f9fa",
                padding: "12px",
                borderRadius: "6px",
                maxHeight: "100px",
                overflowY: "auto"
              }}>
                {application.additionalInfo}
              </div>
            </div>
          )}
          
          <div style={{ marginTop: "15px" }}>
            <a
              href="#"
              onClick={async (e) => {
                e.preventDefault();
                const url = await getFileUrl(application.resume);
                if (url) window.open(url, '_blank');
              }}
              style={{ 
                marginRight: "15px",
                backgroundColor: "#007bff",
                color: "white",
                padding: "8px 12px",
                borderRadius: "4px",
                textDecoration: "none",
                fontSize: "14px"
              }}
            >
              View Resume
            </a>
            <a
              href="#"
              onClick={async (e) => {
                e.preventDefault();
                const url = await getFileUrl(application.transcript);
                if (url) window.open(url, '_blank');
              }}
              style={{
                backgroundColor: "#28a745",
                color: "white",
                padding: "8px 12px",
                borderRadius: "4px",
                textDecoration: "none",
                fontSize: "14px"
              }}
            >
              View Transcript
            </a>
          </div>
        </div>
      </div>

      {/* Status History Section */}
      {application.statusHistory && application.statusHistory.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          <h3>Status History</h3>
          <div style={{
            backgroundColor: "#f8f9fa",
            padding: "12px",
            borderRadius: "6px",
            maxHeight: "200px",
            overflowY: "auto"
          }}>
            {application.statusHistory.slice().reverse().map((entry, index) => (
              <div 
                key={index} 
                style={{
                  padding: "8px",
                  margin: "4px 0",
                  backgroundColor: "white",
                  borderRadius: "4px",
                  border: "1px solid #dee2e6"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{
                    backgroundColor: "#007bff",
                    color: "white",
                    padding: "2px 6px",
                    borderRadius: "3px",
                    fontSize: "12px",
                    fontWeight: "bold"
                  }}>
                    {entry.status}
                  </span>
                  <span style={{ fontSize: "12px", color: "#6c757d" }}>
                    {new Date(entry.changedAt).toLocaleString()}
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "#495057", marginTop: "4px" }}>
                  <strong>Changed by:</strong> {entry.changedBy}
                </div>
                {entry.notes && (
                  <div style={{ fontSize: "12px", color: "#6c757d", marginTop: "4px", fontStyle: "italic" }}>
                    "{entry.notes}"
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comments Section */}
      <div style={{ marginTop: "20px" }}>
        <h3>Admin Comments ({comments.length})</h3>
        
                    {/* Add Comment Form */}
                    <div style={{ marginBottom: "20px" }}>
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder={adminInfo?.permissions?.canAddComments ? "Add a comment about this applicant..." : "You don't have permission to add comments"}
                        disabled={!adminInfo?.permissions?.canAddComments}
                        style={{
                          width: "100%",
                          minHeight: "80px",
                          padding: "12px",
                          border: "2px solid #dee2e6",
                          borderRadius: "6px",
                          fontSize: "14px",
                          resize: "vertical",
                          backgroundColor: adminInfo?.permissions?.canAddComments ? "white" : "#f8f9fa",
                          color: adminInfo?.permissions?.canAddComments ? "#333" : "#6c757d",
                          opacity: adminInfo?.permissions?.canAddComments ? 1 : 0.6
                        }}
            onFocus={(e) => {
              e.target.style.borderColor = "#007bff";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#dee2e6";
            }}
          />
          <div style={{ marginTop: "10px", textAlign: "right" }}>
            <button
              onClick={handleAddComment}
              disabled={!newComment.trim() || isSubmittingComment || !adminInfo?.permissions?.canAddComments}
              style={{
                backgroundColor: (newComment.trim() && !isSubmittingComment && adminInfo?.permissions?.canAddComments) ? "#007bff" : "#6c757d",
                color: "white",
                border: "none",
                padding: "8px 16px",
                borderRadius: "4px",
                cursor: (newComment.trim() && !isSubmittingComment && adminInfo?.permissions?.canAddComments) ? "pointer" : "not-allowed",
                fontSize: "14px",
                opacity: adminInfo?.permissions?.canAddComments ? 1 : 0.6
              }}
            >
              {isSubmittingComment ? "Adding..." : adminInfo?.permissions?.canAddComments ? "Add Comment" : "No Permission"}
            </button>
          </div>
        </div>

        {/* Comments List */}
        <div style={{
          backgroundColor: "#f8f9fa",
          padding: "12px",
          borderRadius: "6px",
          maxHeight: "300px",
          overflowY: "auto"
        }}>
          {comments.length === 0 ? (
            <div style={{ 
              textAlign: "center", 
              color: "#6c757d", 
              fontStyle: "italic",
              padding: "20px"
            }}>
              No comments yet. Be the first to add a comment!
            </div>
          ) : (
            comments.slice().reverse().map((comment, index) => (
              <div 
                key={index} 
                style={{
                  padding: "12px",
                  margin: "8px 0",
                  backgroundColor: "white",
                  borderRadius: "6px",
                  border: "1px solid #dee2e6",
                  borderLeft: "4px solid #007bff"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{
                    backgroundColor: "#007bff",
                    color: "white",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: "bold"
                  }}>
                    {comment.adminName}
                  </span>
                  <span style={{ fontSize: "12px", color: "#6c757d" }}>
                    {new Date(comment.commentedAt).toLocaleString()}
                  </span>
                </div>
                <div style={{ fontSize: "14px", color: "#333", lineHeight: "1.4" }}>
                  {comment.comment}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  </div>
  );
};

// 🟢 **PhasesView Component**
const PhasesView = ({ applications, setSelectedApplication, setApplications, searchTerm, setSearchTerm, adminInfo }) => {
  const [phasePages, setPhasePages] = useState({});
  const [techFilter, setTechFilter] = useState("all"); // Tech filter state
  const applicationsPerPhase = 10;
  const phases = [
    {
      title: "Under Review",
      statuses: ["Under Review"],
      color: "#e2e8f0"
    },
    {
      title: "Case Night",
      statuses: ["Case Night - Yes", "Case Night - No"],
      color: "#bee3f8"
    },
    {
      title: "Final Interview",
      statuses: ["Final Interview - Yes", "Final Interview - No", "Final Interview - Maybe"],
      color: "#fef5e7"
    },
    {
      title: "Final Decision",
      statuses: ["Accepted", "Rejected"],
      color: "#c6f6d5"
    }
  ];

  // Filter applications based on search term and tech filter
  const filteredApplications = applications.filter((app) => {
    // Search filter
    const matchesSearch = !searchTerm || ["fullName", "major", "email"].some((key) =>
      app[key]?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    // Tech filter
    let matchesTechFilter = true;
    if (techFilter === "tech") {
      matchesTechFilter = app.candidateType === "Tech";
    } else if (techFilter === "non-tech") {
      matchesTechFilter = app.candidateType === "Non-Tech";
    }
    // If techFilter is "all", matchesTechFilter remains true
    
    return matchesSearch && matchesTechFilter;
  });

  // Initialize phase pages when applications change
  useEffect(() => {
    const newPhasePages = {};
    phases.forEach(phase => {
      if (!phasePages[phase.title]) {
        newPhasePages[phase.title] = 1;
      }
    });
    if (Object.keys(newPhasePages).length > 0) {
      setPhasePages(prev => ({ ...prev, ...newPhasePages }));
    }
  }, [applications]);

  // Get applications for a specific phase with pagination
  const getPhaseApplications = (phase) => {
    const phaseApps = filteredApplications.filter((app) => 
      phase.statuses.includes(app.status)
    );
    const currentPage = phasePages[phase.title] || 1;
    const startIndex = (currentPage - 1) * applicationsPerPhase;
    const endIndex = startIndex + applicationsPerPhase;
    return {
      applications: phaseApps.slice(startIndex, endIndex),
      totalPages: Math.ceil(phaseApps.length / applicationsPerPhase),
      currentPage,
      totalApplications: phaseApps.length
    };
  };

  // Handle page change for a specific phase
  const handlePhasePageChange = (phaseTitle, pageNumber) => {
    setPhasePages(prev => ({
      ...prev,
      [phaseTitle]: pageNumber
    }));
  };

  const handleDragStart = (e, application) => {
    e.dataTransfer.setData("applicationId", application._id);
    e.dataTransfer.setData("applicationStatus", application.status);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.style.backgroundColor = "#f8f9fa";
    e.currentTarget.style.border = "3px dashed #007bff";
  };

  const handleDragLeave = (e) => {
    e.currentTarget.style.backgroundColor = "white";
    e.currentTarget.style.border = `3px solid ${e.currentTarget.dataset.phaseColor}`;
  };

  const handleDrop = async (e, targetPhase) => {
    e.preventDefault();
    
    // Check if admin has permission to change status
    // Super admins always have permission, regular admins need explicit permission
    const hasPermission = adminInfo?.role === "super_admin" || adminInfo?.permissions?.canChangeStatus;
    
    if (!hasPermission) {
      alert("❌ You don't have permission to change application status.");
      return;
    }

    const applicationId = e.dataTransfer.getData("applicationId");
    const currentStatus = e.dataTransfer.getData("applicationStatus");
    
    // Determine the new status based on the target phase
    let newStatus;
    switch (targetPhase.title) {
      case "Under Review":
        newStatus = "Under Review";
        break;
      case "Case Night":
        // If coming from Under Review, default to "Case Night - Yes"
        // If already in Case Night, keep current status
        if (currentStatus === "Under Review") {
          newStatus = "Case Night - Yes";
        } else if (targetPhase.statuses.includes(currentStatus)) {
          newStatus = currentStatus;
        } else {
          newStatus = "Case Night - Yes";
        }
        break;
      case "Final Interview":
        // If coming from Case Night - Yes, default to "Final Interview - Yes"
        if (currentStatus === "Case Night - Yes") {
          newStatus = "Final Interview - Yes";
        } else if (targetPhase.statuses.includes(currentStatus)) {
          newStatus = currentStatus;
        } else {
          newStatus = "Final Interview - Yes";
        }
        break;
      case "Final Decision":
        // If coming from Final Interview - Yes, default to "Accepted"
        if (currentStatus === "Final Interview - Yes") {
          newStatus = "Accepted";
        } else if (targetPhase.statuses.includes(currentStatus)) {
          newStatus = currentStatus;
        } else {
          newStatus = "Accepted";
        }
        break;
      default:
        newStatus = "Under Review";
    }

    try {
      const adminEmail = localStorage.getItem("adminEmail") || "Unknown Admin";
      
      // Update the application status
      await axios.put(`${API_BASE_URL}/api/applications/${applicationId}`, {
        status: newStatus,
        changedBy: adminEmail,
        notes: `Moved from ${currentStatus} to ${newStatus} via drag and drop`
      }, {
        headers: {
          'x-admin-email': adminEmail
        }
      });
      
      // Update local state
      const updatedApplications = applications.map(app => 
        app._id === applicationId ? { ...app, status: newStatus } : app
      );
      setApplications(updatedApplications);
      console.log(`✅ Successfully moved application ${applicationId} from ${currentStatus} to ${newStatus}`);
    } catch (error) {
      console.error("Error updating application status:", error);
      if (error.response?.data?.error) {
        alert(`❌ Failed to update status: ${error.response.data.error}`);
      } else {
        alert("❌ Failed to update application status. Please try again.");
      }
    }
  };

  return (
    <div>
      {/* Search Bar and Tech Filter */}
      <div style={{ 
        marginBottom: "20px", 
        padding: "0 20px",
        display: "flex",
        justifyContent: "center",
        gap: "16px",
        alignItems: "center"
      }}>
        <input
          type="text"
          placeholder="Search by name, major, or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: "100%",
            maxWidth: "400px",
            padding: "12px 16px",
            fontSize: "16px",
            border: "2px solid #dee2e6",
            borderRadius: "8px",
            outline: "none",
            backgroundColor: "white",
            color: "#333",
            transition: "border-color 0.2s ease"
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "#007bff";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "#dee2e6";
          }}
        />
        <select
          value={techFilter}
          onChange={(e) => setTechFilter(e.target.value)}
          style={{
            padding: "12px 16px",
            fontSize: "16px",
            border: "2px solid #dee2e6",
            borderRadius: "8px",
            backgroundColor: "white",
            outline: "none",
            transition: "border-color 0.2s ease",
            minWidth: "150px"
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "#007bff";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "#dee2e6";
          }}
        >
          <option value="all">All Applications</option>
          <option value="tech">Tech Only</option>
          <option value="non-tech">Non-Tech Only</option>
        </select>
      </div>
      
      {/* Search Results Counter */}
      {(searchTerm || techFilter !== "all") && (
        <div style={{ 
          textAlign: "center", 
          marginBottom: "10px",
          color: "#6c757d",
          fontSize: "14px"
        }}>
          Showing {filteredApplications.length} of {applications.length} applications
          {techFilter !== "all" && ` (${techFilter === "tech" ? "Tech" : "Non-Tech"} only)`}
        </div>
      )}
      
      <div className="application-phases" style={{ display: "flex", gap: "20px", padding: "20px" }}>
        {phases.map((phase) => {
          const phaseData = getPhaseApplications(phase);
          return (
            <div
              key={phase.title}
              style={{
                flex: 1,
                backgroundColor: "white",
                borderRadius: "8px",
                padding: "16px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                border: `3px solid ${phase.color}`,
                minHeight: "400px",
                display: "flex",
                flexDirection: "column"
              }}
              onDragOver={(adminInfo?.role === "super_admin" || adminInfo?.permissions?.canChangeStatus) ? handleDragOver : undefined}
              onDragLeave={(adminInfo?.role === "super_admin" || adminInfo?.permissions?.canChangeStatus) ? handleDragLeave : undefined}
              onDrop={(adminInfo?.role === "super_admin" || adminInfo?.permissions?.canChangeStatus) ? (e) => {
                handleDrop(e, phase);
                e.currentTarget.style.backgroundColor = "white";
                e.currentTarget.style.border = `3px solid ${phase.color}`;
              } : undefined}
              data-phase-color={phase.color}
            >
              <h3 style={{ 
                margin: "0 0 16px 0", 
                padding: "8px", 
                backgroundColor: phase.color, 
                borderRadius: "4px",
                textAlign: "center",
                fontWeight: "bold"
              }}>
                {phase.title} ({phaseData.totalApplications})
              </h3>
              
              {/* Applications List */}
              <div style={{ flex: 1, minHeight: "200px" }}>
                {phaseData.applications.map((app) => (
                            <div 
                              key={app._id} 
                              draggable={adminInfo?.role === "super_admin" || adminInfo?.permissions?.canChangeStatus}
                              onDragStart={(e) => handleDragStart(e, app)}
                              style={{
                                backgroundColor: "#f8f9fa",
                                padding: "12px",
                                margin: "8px 0",
                                borderRadius: "6px",
                                border: "1px solid #dee2e6",
                                cursor: (adminInfo?.role === "super_admin" || adminInfo?.permissions?.canChangeStatus) ? "grab" : "default",
                                transition: "all 0.2s ease",
                                userSelect: "none",
                                opacity: (adminInfo?.role === "super_admin" || adminInfo?.permissions?.canChangeStatus) ? 1 : 0.8
                              }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = "translateY(-2px)";
                    e.target.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = "translateY(0)";
                    e.target.style.boxShadow = "none";
                  }}
                >
                  <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                    <img
                      src={app.image || "/default-profile.png"}
                      alt="Profile"
                      width="40"
                      height="40"
                      style={{ 
                        borderRadius: "6px",
                        objectFit: "cover",
                        flexShrink: 0
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ margin: "0 0 4px 0", fontSize: "14px" }}>
                        {app.fullName}
                      </h4>
                      <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#6c757d" }}>
                        {app.email}
                      </p>
                      <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#6c757d" }}>
                        {app.major} • {app.studentYear} • {app.candidateType}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      style={{
                        backgroundColor: "#007bff",
                        color: "white",
                        border: "none",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        cursor: "pointer"
                      }}
                      onClick={() => setSelectedApplication(app)}
                    >
                      View
                    </button>
                    <span style={{
                      backgroundColor: "#28a745",
                      color: "white",
                      padding: "2px 6px",
                      borderRadius: "3px",
                      fontSize: "10px",
                      fontWeight: "bold"
                    }}>
                      {app.status}
                    </span>
                  </div>
                </div>
                ))}
                {phaseData.applications.length === 0 && (
                  <div style={{ 
                    textAlign: "center", 
                    color: "#6c757d", 
                    fontStyle: "italic",
                    margin: "20px 0",
                    padding: "40px 20px",
                    border: "2px dashed #dee2e6",
                    borderRadius: "8px",
                    backgroundColor: "#f8f9fa"
                  }}>
                    <p style={{ margin: "0 0 10px 0" }}>No applications in this phase</p>
                    <p style={{ margin: "0", fontSize: "12px" }}>Drop applications here</p>
                  </div>
                )}
              </div>
              
              {/* Pagination Controls */}
              {phaseData.totalPages > 1 && (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto 1fr",
                  alignItems: "center",
                  marginTop: "12px",
                  padding: "6px 8px",
                  backgroundColor: "#f8f9fa",
                  borderRadius: "4px",
                  border: "1px solid #dee2e6"
                }}>
                  <button
                    onClick={() => handlePhasePageChange(phase.title, phaseData.currentPage - 1)}
                    disabled={phaseData.currentPage === 1}
                    style={{
                      backgroundColor: phaseData.currentPage === 1 ? "#6c757d" : "#007bff",
                      color: "white",
                      border: "none",
                      padding: "4px 8px",
                      borderRadius: "3px",
                      cursor: phaseData.currentPage === 1 ? "not-allowed" : "pointer",
                      fontSize: "10px",
                      opacity: phaseData.currentPage === 1 ? 0.6 : 1,
                      justifySelf: "start"
                    }}
                  >
                    ← Prev
                  </button>
                  
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center"
                  }}>
                    <span style={{
                      fontSize: "10px",
                      color: "#6c757d",
                      fontWeight: "bold"
                    }}>
                      Applications {((phaseData.currentPage - 1) * applicationsPerPhase) + 1}-{Math.min(phaseData.currentPage * applicationsPerPhase, phaseData.totalApplications)}
                    </span>
                    <span style={{
                      fontSize: "10px",
                      color: "#6c757d",
                      fontWeight: "bold"
                    }}>
                      of {phaseData.totalApplications}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => handlePhasePageChange(phase.title, phaseData.currentPage + 1)}
                    disabled={phaseData.currentPage === phaseData.totalPages}
                    style={{
                      backgroundColor: phaseData.currentPage === phaseData.totalPages ? "#6c757d" : "#007bff",
                      color: "white",
                      border: "none",
                      padding: "4px 8px",
                      borderRadius: "3px",
                      cursor: phaseData.currentPage === phaseData.totalPages ? "not-allowed" : "pointer",
                      fontSize: "10px",
                      opacity: phaseData.currentPage === phaseData.totalPages ? 0.6 : 1,
                      justifySelf: "end"
                    }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AssociatePage;
