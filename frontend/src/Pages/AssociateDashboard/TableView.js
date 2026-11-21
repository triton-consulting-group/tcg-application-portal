import React from "react";
import { getFileUrl } from "./api";

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
              <button
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const url = await getFileUrl(app.resume);
                  if (url) window.open(url, '_blank');
                }}
                style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline' }}
              >
                View Resume
              </button>
            </td>
            <td>
              <button
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const url = await getFileUrl(app.transcript);
                  if (url) window.open(url, '_blank');
                }}
                style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline' }}
              >
                View Transcript
              </button>
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

export default TableView;
