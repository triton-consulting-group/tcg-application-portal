import React, { useState, useEffect, useMemo } from "react";
import dashboardApi from "./api";

// 🟢 **PhasesView Component**
const PhasesView = ({ applications, setSelectedApplication, setApplications, searchTerm, setSearchTerm, adminInfo }) => {
  const [phaseGroup, setPhaseGroup] = useState(1);
  const [phasePages, setPhasePages] = useState({});
  const [techFilter, setTechFilter] = useState("all"); // Tech filter state
  const [exportingPhase, setExportingPhase] = useState(null);
  const applicationsPerPhase = 10;
  const phases = useMemo(() => [
    {
      title: "Under Review",
      statuses: ["Under Review"],
      color: "#808080"
    },
    {
      title: "Case Night-No",
      statuses: ["Case Night - No"],
      color: "#c21807"
    },
    {
      title: "Case Night-Yes",
      statuses: ["Case Night - Yes"],
      color: "#3bb143"
    },
    {
      title: "Final Interview - No",
      statuses: ["Final Interview - No"],
      color: "#c21807"
    },
    {
      title: "Final Interview-Yes",
      statuses: ["Final Interview - Yes"],
      color: "#3bb143"
    },
    {
      title: "Accepted",
      statuses: ["Accepted"],
      color: "#3bb143"
    },
    {
      title: "Rejected",
      statuses: ["Rejected"],
      color: "#c21807"
    }
  ], []);

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
  }, [applications, phasePages, phases]);

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

  // Export function for a specific phase
  const handleExportPhase = async (phase) => {
    setExportingPhase(phase.title);
    try {
      // Build query string with all statuses for this phase
      const statusesParam = phase.statuses.join(',');
      const response = await dashboardApi.exportPhase(statusesParam);

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const phaseName = phase.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      link.setAttribute('download', `applicants-${phaseName}-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      alert(`Exported applicants from "${phase.title}" successfully!`);
    } catch (error) {
      console.error("Error exporting phase:", error);
      if (error.response?.status === 404) {
        alert(`No applicants found in "${phase.title}" phase to export.`);
      } else {
        alert(`Failed to export "${phase.title}" applicants. Please try again.`);
      }
    } finally {
      setExportingPhase(null);
    }
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
    e.currentTarget.style.border = "2px dashed #007bff";
  };

  const handleDragLeave = (e) => {
    e.currentTarget.style.backgroundColor = "white";
    e.currentTarget.style.border = `2px solid ${e.currentTarget.dataset.phaseColor}`;
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
      case "Case Night-No":
        newStatus = "Case Night - No";
        break;
      case "Case Night-Yes":
        newStatus = "Case Night - Yes";
        break;
      case "Final Interview - No":
        newStatus = "Final Interview - No";
        break;
      case "Final Interview-Yes":
        newStatus = "Final Interview - Yes";
        break;
      case "Accepted":
        newStatus = "Accepted";
        break;
      case "Rejected":
        newStatus = "Rejected";
        break;
      default:
        newStatus = currentStatus; // Fallback to current status if title doesn't match
    }

    try {
      // Update the application status
      await dashboardApi.updateApplication(applicationId, {
        status: newStatus,
        notes: `Moved from ${currentStatus} to ${newStatus} via drag and drop`
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
  //creating two seperate 'phase groups' to show each page in phasesView
  const phasestoShow = phaseGroup === 1 ? phases.slice(0, 3) : phases.slice(3, 7)
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
        {phasestoShow.map((phase) => {
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
                border: `2px solid ${phase.color}`,
                minHeight: "400px",
                display: "flex",
                flexDirection: "column"
              }}
              onDragOver={(adminInfo?.role === "super_admin" || adminInfo?.permissions?.canChangeStatus) ? handleDragOver : undefined}
              onDragLeave={(adminInfo?.role === "super_admin" || adminInfo?.permissions?.canChangeStatus) ? handleDragLeave : undefined}
              onDrop={(adminInfo?.role === "super_admin" || adminInfo?.permissions?.canChangeStatus) ? (e) => {
                handleDrop(e, phase);
                e.currentTarget.style.backgroundColor = "white";
                e.currentTarget.style.border = `2px solid ${phase.color}`;
              } : undefined}
              data-phase-color={phase.color}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{
                  margin: "0",
                  padding: "8px",
                  backgroundColor: phase.color,
                  borderRadius: "4px",
                  textAlign: "center",
                  fontWeight: "bold",
                  flex: 1
                }}>
                  {phase.title} ({phaseData.totalApplications})
                </h3>
                <button
                  onClick={() => handleExportPhase(phase)}
                  disabled={exportingPhase === phase.title || phaseData.totalApplications === 0}
                  style={{
                    backgroundColor: exportingPhase === phase.title ? "#6c757d" : "#28a745",
                    color: "white",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    cursor: exportingPhase === phase.title || phaseData.totalApplications === 0 ? "not-allowed" : "pointer",
                    fontSize: "12px",
                    fontWeight: "bold",
                    marginLeft: "8px",
                    opacity: exportingPhase === phase.title || phaseData.totalApplications === 0 ? 0.6 : 1,
                    alignSelf: "stretch",
                    whiteSpace: "nowrap"
                  }}
                  title={phaseData.totalApplications === 0 ? "No applicants to export" : `Export all applicants in ${phaseData.totalApplications} phase to CSV`}
                >
                  <h3 style={{
                    margin: "0",
                    padding: "auto",
                    fontSize: "13.5px",
                    fontWeight: "200",
                  }}>
                    {exportingPhase === phase.title ? "Exporting..." : "Export"}
                  </h3>
                </button>
              </div>

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
                      opacity: (adminInfo?.role === "super_admin" || adminInfo?.permissions?.canChangeStatus) ? 1 : 0.8,
                      position: "relative"
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
                    {/* Comment Icon Badge */}
                    {app.comments?.length > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          top: "8px",
                          right: "8px",
                          backgroundColor: "#ff6b6b",
                          borderRadius: "50%",
                          width: "24px",
                          height: "24px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          pointerEvents: "none",
                          zIndex: 10,
                          boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                        }}
                        title={`${app.comments.length} admin comment(s)`}
                        aria-label={`Has ${app.comments.length} admin comment(s)`}
                      >
                        <span style={{ color: "white", fontSize: "12px" }}>💬</span>
                        {app.comments.length > 1 && (
                          <span style={{
                            position: "absolute",
                            top: "-4px",
                            right: "-4px",
                            backgroundColor: "#fff",
                            color: "#ff6b6b",
                            borderRadius: "50%",
                            width: "16px",
                            height: "16px",
                            fontSize: "10px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: "bold",
                            border: "1px solid #ff6b6b"
                          }}>
                            {app.comments.length}
                          </span>
                        )}
                      </div>
                    )}
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
                        backgroundColor:
                          app.status === "Under Review" ? "#808080" :
                            (app.status.includes("Yes") || app.status === "Accepted") ? "#3bb143" :
                              (app.status.includes("No") || app.status === "Rejected") ? "#c21807" :
                                "#6c757d",
                        color: "white",
                        padding: "2px 6px",
                        borderRadius: "3px",
                        fontSize: "10px",
                        fontWeight: "bold",
                        display: "inline-flex",
                        alignItems: "center",
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

      <div style={{ textAlign: "center", marginTop: "20px", paddingBottom: "40px" }}>
        {phaseGroup === 1 ? (
          <button
            onClick={() => {
              setPhaseGroup(2);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            style={{
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              padding: "12px 24px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "bold",
              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
              transition: "all 0.2s ease"
            }}
          >
            Next View (Categories 4-7) →
          </button>
        ) : (
          <button
            onClick={() => {
              setPhaseGroup(1);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            style={{
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              padding: "12px 24px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "bold",
              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
              transition: "all 0.2s ease"
            }}
          >
            ← Back to First View (Categories 1-3)
          </button>
        )}
      </div>
    </div>
  );
};

export default PhasesView;
