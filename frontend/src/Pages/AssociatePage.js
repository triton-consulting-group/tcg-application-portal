import React, { useState, useMemo, useEffect } from "react";
import axios from "axios";
import "./associatePage.css";

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

  useEffect(() => {
    axios
      .get("http://localhost:5002/api/applications")
      .then((response) => {
        setApplications(response.data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("❌ Error fetching applications:", error);
        setError("Failed to fetch applications.");
        setLoading(false);
      });
  }, []);

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

  const updateStatus = (applicationId, newStatus) => {
    axios
      .put(`http://localhost:5002/api/applications/${applicationId}`, {
        status: newStatus,
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

  return (
    <div className="associate-page">
      <h1>Triton Consulting Group - Associate Portal</h1>

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
            setApplications={setApplications} // ✅ Pass setApplications to PhasesView
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
                <option value="Maybe">Maybe</option>
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
    <div className="modal-content">
      <button className="close-button" onClick={onClose}>
        ×
      </button>
      <h2>{application.fullName}'s Application</h2>
      <img
        src={`http://localhost:5002${application.image}`}
        alt="Profile"
        width="100"
        height="100"
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
        <strong>Reason for Applying:</strong> {application.reason}
      </p>{" "}
      {/* ✅ Full essay shown here */}
      <div style={{ marginTop: "10px" }}>
        <a
          href={`http://localhost:5002${application.resume}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ marginRight: "15px" }}
        >
          View Resume
        </a>
        <a
          href={`http://localhost:5002${application.transcript}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View Transcript
        </a>
      </div>
    </div>
  </div>
);

// 🟢 **PhasesView Component**
const PhasesView = ({ applications, setSelectedApplication }) => {
  return (
    <div className="application-phases">
      {["Under Review", "Maybe", "Accepted", "Rejected"].map((status) => (
        <div
          key={status}
          className={`status-column ${status.toLowerCase().replace(" ", "-")}`}
        >
          <h3>{status}</h3>
          <div className="application-list">
            {applications
              .filter((app) => app.status === status) // ✅ Always uses updated applications
              .map((app) => (
                <div key={app._id} className="application-card">
                  <h4>{app.fullName}</h4>
                  <button
                    className="view-button"
                    onClick={() => setSelectedApplication(app)}
                  >
                    View Full Application
                  </button>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AssociatePage;
