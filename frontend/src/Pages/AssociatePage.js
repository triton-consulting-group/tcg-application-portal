import React, { useState, useMemo, useEffect } from "react";
import axios from "axios";
import "./associatePage.css";
import { getAuth, onAuthStateChanged } from "firebase/auth";

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

  useEffect(() => {
    // Check authentication state
    const auth = getAuth();
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
  }, []);

  const checkAdminStatus = async (email) => {
    try {
      const response = await axios.post("http://localhost:5002/api/admin/check", { email });
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
  };

  const fetchApplications = async () => {
    try {
      const response = await axios.get("http://localhost:5002/api/applications");
      setApplications(response.data);
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

  const updateStatus = (applicationId, newStatus, notes = "") => {
    const adminEmail = localStorage.getItem("adminEmail") || currentUser?.email || "Unknown Admin";
    
    axios
      .put(`http://localhost:5002/api/applications/${applicationId}`, {
        status: newStatus,
        changedBy: adminEmail,
        notes: notes
      })
      .then(() => {
        return axios.get("http://localhost:5002/api/applications"); // 🔹 Refetch all applications
      })
      .then((response) => {
        setApplications(response.data); // 🔹 Update state with fresh data from the backend
      })
      .catch((error) => console.error("❌ Error updating status:", error));
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
            applications={filteredApplications}
            setSelectedApplication={setSelectedApplication}
            requestSort={requestSort}
            sortConfig={sortConfig}
            updateStatus={updateStatus}
            setSearchTerm={setSearchTerm}
            setSelectedImage={setSelectedImage}
          />
        ) : (
          <PhasesView
            applications={applications}
            setSelectedApplication={setSelectedApplication}
            setApplications={setApplications}
          />
        )}
      </div>

      {selectedApplication && (
        <ApplicationDetail
          application={selectedApplication}
          onClose={() => setSelectedApplication(null)}
          updateStatus={updateStatus}
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
}) => (
  <div className="all-applications">
    <div className="search-bar">
      <input
        type="text"
        placeholder="Search by name, major, or email..."
        onChange={(e) => setSearchTerm(e.target.value)}
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
          <tr key={app._id}>
            <td>{app.email}</td>
            <td>{app.fullName}</td>
            <td>{app.studentYear}</td>
            <td>{app.major}</td>
            <td>{app.appliedBefore}</td>
            <td>{app.candidateType}</td>
            <td>
              <a
                href={`http://localhost:5002${app.resume || ""}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Resume
              </a>
            </td>
            <td>
              <a
                href={`http://localhost:5002${app.transcript || ""}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Transcript
              </a>
            </td>
            <td>
              <img
                src={`http://localhost:5002${
                  app.image || "/default-profile.png"
                }`}
                alt="Profile"
                width="50"
                height="50"
                onClick={() =>
                  setSelectedImage(`http://localhost:5002${app.image}`)
                }
                style={{ cursor: "pointer" }}
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
                onClick={() => setSelectedApplication(app)}
              >
                View Application
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
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
const ApplicationDetail = ({ application, onClose }) => (
  <div className="modal-overlay">
    <div className="modal-content" style={{ maxWidth: "800px", maxHeight: "90vh", overflowY: "auto" }}>
      <button className="close-button" onClick={onClose}>
        ×
      </button>
      <h2>{application.fullName}'s Application</h2>
      
      <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
        <div style={{ flex: 1 }}>
          <img
            src={`http://localhost:5002${application.image}`}
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
          
          <div style={{ marginTop: "15px" }}>
            <a
              href={`http://localhost:5002${application.resume}`}
              target="_blank"
              rel="noopener noreferrer"
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
              href={`http://localhost:5002${application.transcript}`}
              target="_blank"
              rel="noopener noreferrer"
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
    </div>
  </div>
);

// 🟢 **PhasesView Component**
const PhasesView = ({ applications, setSelectedApplication, setApplications }) => {
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
      await axios.put(`http://localhost:5002/api/applications/${applicationId}`, {
        status: newStatus,
        changedBy: adminEmail,
        notes: `Moved from ${currentStatus} to ${newStatus} via drag and drop`
      });
      
      // Update local state
      const updatedApplications = applications.map(app => 
        app._id === applicationId ? { ...app, status: newStatus } : app
      );
      setApplications(updatedApplications);
    } catch (error) {
      console.error("Error updating application status:", error);
      alert("Failed to update application status");
    }
  };

  return (
    <div className="application-phases" style={{ display: "flex", gap: "20px", padding: "20px" }}>
      {phases.map((phase) => (
        <div
          key={phase.title}
          style={{
            flex: 1,
            backgroundColor: "white",
            borderRadius: "8px",
            padding: "16px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            border: `3px solid ${phase.color}`,
            minHeight: "400px"
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={(e) => {
            handleDrop(e, phase);
            e.currentTarget.style.backgroundColor = "white";
            e.currentTarget.style.border = `3px solid ${phase.color}`;
          }}
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
            {phase.title}
          </h3>
          <div style={{ minHeight: "200px" }}>
            {applications
              .filter((app) => phase.statuses.includes(app.status))
              .map((app) => (
                <div 
                  key={app._id} 
                  draggable
                  onDragStart={(e) => handleDragStart(e, app)}
                  style={{
                    backgroundColor: "#f8f9fa",
                    padding: "12px",
                    margin: "8px 0",
                    borderRadius: "6px",
                    border: "1px solid #dee2e6",
                    cursor: "grab",
                    transition: "all 0.2s ease",
                    userSelect: "none"
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
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "14px" }}>
                    {app.fullName}
                  </h4>
                  <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#6c757d" }}>
                    {app.email}
                  </p>
                  <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#6c757d" }}>
                    {app.major} • {app.studentYear}
                  </p>
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
            {applications.filter((app) => phase.statuses.includes(app.status)).length === 0 && (
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
        </div>
      ))}
    </div>
  );
};

export default AssociatePage;
