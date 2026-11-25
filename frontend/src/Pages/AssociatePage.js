import React, { useState, useMemo, useEffect, useCallback } from "react";
import "./associatePage.css";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./Home/firebaseConfig";
import dashboardApi from "./AssociateDashboard/api";
import TableView from "./AssociateDashboard/TableView";
import PhasesView from "./AssociateDashboard/PhasesView";
import ApplicationDetail from "./AssociateDashboard/ApplicationDetail";
import { replaceApplication } from "../utils/applications";
import { getErrorMessage } from "../utils/caseGroups";
import BuildCaseGroupsModal from "./ApplicationComponents/BuildCaseGroupsModal";
import ModalErrorBoundary from "./ApplicationComponents/ModalErrorBoundary";
import CaseGroupsModal from "./ApplicationComponents/CaseGroupsModal";

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
  const [showBuildCaseGroups, setShowBuildCaseGroups] = useState(false);
  const [showCaseGroups, setShowCaseGroups] = useState(false);
  const [caseNightConfig, setCaseNightConfig] = useState(null);

  const checkAdminStatus = useCallback(async (email) => {
    try {
      const response = await dashboardApi.checkAdmin(email);
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
        const response = await dashboardApi.getCaseNightConfig();
        setCaseNightConfig(response.data);
      } catch (error) {
        console.error("Error fetching case night config:", error);
      }
    };
    fetchCaseNightConfig();
  }, []);

  const fetchApplications = async () => {
    try {
      const response = await dashboardApi.getApplications();
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
      const response = await dashboardApi.exportCaseGroups();

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
      alert(await getErrorMessage(error, "Failed to export case groups. Please try again."));
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

    dashboardApi.updateApplication(applicationId, {
      status: newStatus,
      notes: notes
    })
      .then((response) => {
        // The PUT returns the updated application; merge just that one instead of
        // re-downloading every application (~3 MB at 700 applicants) on each change
        setApplications((prev) => replaceApplication(prev, response.data));
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

  // Keeps the list (kanban badges) and the open modal's application in sync when comments
  // are added or deleted. `updater` maps the previous comments array to the next one.
  const handleCommentsChange = (applicationId, updater) => {
    const withComments = (app) => ({ ...app, comments: updater(app.comments || []) });
    setApplications((prev) => prev.map((app) => (app._id === applicationId ? withComments(app) : app)));
    setSelectedApplication((prev) => (prev && prev._id === applicationId ? withComments(prev) : prev));
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
            {adminInfo?.role === "super_admin" && (
              <>
                <button
                  onClick={() => setShowBuildCaseGroups(true)}
                  style={{
                    backgroundColor: "#6f42c1",
                    color: "white",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "14px"
                  }}
                >
                  Build Case Groups
                </button>
                <button
                  onClick={() => setShowCaseGroups(true)}
                  style={{
                    backgroundColor: "#17a2b8",
                    color: "white",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "14px"
                  }}
                >
                  Case Groups
                </button>
              </>
            )}
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
          onCommentsChange={handleCommentsChange}
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

      {showBuildCaseGroups && (
        <ModalErrorBoundary onClose={() => setShowBuildCaseGroups(false)}>
          <BuildCaseGroupsModal
            onClose={() => setShowBuildCaseGroups(false)}
            onBuilt={(created) => {
              setShowBuildCaseGroups(false);
              alert(`Built ${created} case group assignments. You can export them now.`);
            }}
          />
        </ModalErrorBoundary>
      )}

      {showCaseGroups && (
        <ModalErrorBoundary onClose={() => setShowCaseGroups(false)}>
          <CaseGroupsModal caseNightConfig={caseNightConfig} onClose={() => setShowCaseGroups(false)} />
        </ModalErrorBoundary>
      )}
    </div>
  );
};

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

export default AssociatePage;
