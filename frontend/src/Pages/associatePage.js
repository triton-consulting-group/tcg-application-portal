import React, { useState, useMemo } from "react";
import "./associatePage.css";

const sampleApplications = [
  {
    id: "1",
    fullName: "John Doe",
    email: "john@ucsd.edu",
    year: "Junior",
    major: "Computer Science",
    resume: "link-to-resume-1.pdf",
    transcript: "link-to-transcript-1.pdf",
    picture: "link-to-picture-1.jpg",
    previousApplicant: false,
    techCandidate: true,
    caseNightSession: "Session A",
    essay:
      "I want to join Triton Consulting Group because I believe in the power of strategic thinking and problem-solving. Through my experiences in computer science and previous consulting projects, I have developed a strong analytical mindset that I wish to apply to real-world business challenges. TCG offers the perfect platform to leverage my technical background while developing essential consulting skills.",
    additionalInfo: "Previously interned at McKinsey",
    status: "Under Review",
    notes: "",
  },
  {
    id: "2",
    fullName: "Jane Smith",
    email: "jane@ucsd.edu",
    year: "Senior",
    major: "Economics",
    resume: "link-to-resume-2.pdf",
    transcript: "link-to-transcript-2.pdf",
    picture: "link-to-picture-2.jpg",
    previousApplicant: true,
    techCandidate: false,
    caseNightSession: "Session B",
    essay:
      "As a returning applicant, my passion for consulting has only grown stronger. My economics background and leadership experience in various campus organizations have prepared me well for the challenges of consulting. I am particularly drawn to TCG's focus on professional development and hands-on client experience.",
    additionalInfo: "Leadership experience in Finance Club",
    status: "Under Review",
    notes: "",
  },
  {
    id: "3",
    fullName: "Alice Johnson",
    email: "alice@ucsd.edu",
    year: "Sophomore",
    major: "Engineering",
    resume: "link-to-resume-3.pdf",
    transcript: "link-to-transcript-3.pdf",
    picture: "link-to-picture-3.jpg",
    previousApplicant: false,
    techCandidate: true,
    caseNightSession: "Session C",
    essay:
      "Driven by a passion for innovation and problem-solving, I am eager to contribute to Triton Consulting Group. My background in engineering equips me with analytical skills and a systematic approach to challenges. I am particularly interested in TCG's work in the tech sector and believe I can make a valuable contribution.",
    additionalInfo: "Participated in hackathons",
    status: "Accepted",
    notes: "",
  },
  {
    id: "4",
    fullName: "Bob Williams",
    email: "bob@ucsd.edu",
    year: "Freshman",
    major: "Business",
    resume: "link-to-resume-4.pdf",
    transcript: "link-to-transcript-4.pdf",
    picture: "link-to-picture-4.jpg",
    previousApplicant: false,
    techCandidate: false,
    caseNightSession: "Session A",
    essay:
      "As a freshman with a keen interest in business strategy, I am excited about the opportunity to learn and grow with Triton Consulting Group. My involvement in business-related extracurriculars has given me a foundational understanding of the consulting world. I am particularly drawn to TCG's commitment to mentorship and professional development.",
    additionalInfo: "Active in business club",
    status: "Rejected",
    notes: "",
  },
  {
    id: "5",
    fullName: "Eva Brown",
    email: "eva@ucsd.edu",
    year: "Junior",
    major: "Mathematics",
    resume: "link-to-resume-5.pdf",
    transcript: "link-to-transcript-5.pdf",
    picture: "link-to-picture-5.jpg",
    previousApplicant: true,
    techCandidate: true,
    caseNightSession: "Session B",
    essay:
      "With a strong mathematical background and a passion for solving complex problems, I am eager to contribute to Triton Consulting Group. My analytical skills and attention to detail make me well-suited for the challenges of consulting. I am particularly interested in TCG's work in data analytics and believe I can make a valuable contribution.",
    additionalInfo: "Research experience in data analysis",
    status: "Maybe",
    notes: "",
  },
];

// Application Detail Modal Component
const ApplicationDetail = ({
  application,
  onClose,
  updateStatus,
  updateNotes,
}) => (
  <div className="modal-overlay">
    <div className="modal-content">
      <button className="close-button" onClick={onClose}>
        ×
      </button>
      <h2>{application.fullName}'s Application</h2>

      <div className="application-details">
        <div className="detail-section">
          <h3>Basic Information</h3>
          <p>
            <strong>Email:</strong> {application.email}
          </p>
          <p>
            <strong>Year:</strong> {application.year}
          </p>
          <p>
            <strong>Major:</strong> {application.major}
          </p>
          <p>
            <strong>Track:</strong>{" "}
            {application.techCandidate ? "Tech" : "Non-tech"}
          </p>
          <p>
            <strong>Case Night:</strong> {application.caseNightSession}
          </p>
          <p>
            <strong>Previous Applicant:</strong>{" "}
            {application.previousApplicant ? "Yes" : "No"}
          </p>
        </div>

        <div className="detail-section">
          <h3>Documents</h3>
          <div className="document-links">
            <a
              href={application.resume}
              target="_blank"
              rel="noopener noreferrer"
            >
              View Resume
            </a>
            <a
              href={application.transcript}
              target="_blank"
              rel="noopener noreferrer"
            >
              View Transcript
            </a>
            <a
              href={application.picture}
              target="_blank"
              rel="noopener noreferrer"
            >
              View Picture
            </a>
          </div>
        </div>

        <div className="detail-section">
          <h3>Essay Response</h3>
          <div className="essay-text">{application.essay}</div>
        </div>

        <div className="detail-section">
          <h3>Additional Information</h3>
          <p>{application.additionalInfo}</p>
        </div>

        <div className="detail-section">
          <h3>Status and Notes</h3>
          <select
            value={application.status}
            onChange={(e) => updateStatus(application.id, e.target.value)}
            className="status-select"
          >
            <option value="Under Review">Under Review</option>
            <option value="Maybe">Maybe</option>
            <option value="Accepted">Accepted</option>
            <option value="Rejected">Rejected</option>
          </select>
          <textarea
            placeholder="Add notes about the candidate..."
            value={application.notes}
            onChange={(e) => updateNotes(application.id, e.target.value)}
            className="notes-textarea"
          />
        </div>
      </div>
    </div>
  </div>
);

// Main AssociatePage Component
const AssociatePage = () => {
  const [applications, setApplications] = useState(sampleApplications);
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "ascending",
  });

  // Function to request sort
  const requestSort = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  // Memoized sorted applications
  const sortedApplications = useMemo(() => {
    let sortableItems = [...applications];
    if (sortConfig !== null && sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === "ascending" ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === "ascending" ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [applications, sortConfig]);

  // Memoized filtered applications
  const filteredApplications = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return sortedApplications.filter((app) => {
      return (
        app.fullName.toLowerCase().includes(lowerSearchTerm) ||
        app.major.toLowerCase().includes(lowerSearchTerm) ||
        app.email.toLowerCase().includes(lowerSearchTerm)
      );
    });
  }, [searchTerm, sortedApplications]);

  // Update application status
  const updateStatus = (applicationId, newStatus) => {
    setApplications((prevApplications) =>
      prevApplications.map((app) =>
        app.id === applicationId ? { ...app, status: newStatus } : app
      )
    );
  };

  // Update application notes
  const updateNotes = (applicationId, newNotes) => {
    setApplications((prevApplications) =>
      prevApplications.map((app) =>
        app.id === applicationId ? { ...app, notes: newNotes } : app
      )
    );
  };

  // Tab content components
  const TableView = () => (
    <div className="all-applications">
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by name, major, or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <table>
        <thead>
          <tr>
            <th>
              Name
              <button
                onClick={() => requestSort("fullName")}
                className="sort-button"
              >
                {sortConfig.key === "fullName" &&
                sortConfig.direction === "ascending"
                  ? "▼"
                  : "▲"}
              </button>
            </th>
            <th>
              Year
              <button
                onClick={() => requestSort("year")}
                className="sort-button"
              >
                {sortConfig.key === "year" &&
                sortConfig.direction === "ascending"
                  ? "▼"
                  : "▲"}
              </button>
            </th>
            <th>
              Major
              <button
                onClick={() => requestSort("major")}
                className="sort-button"
              >
                {sortConfig.key === "major" &&
                sortConfig.direction === "ascending"
                  ? "▼"
                  : "▲"}
              </button>
            </th>
            <th>
              Track
              <button
                onClick={() => requestSort("techCandidate")}
                className="sort-button"
              >
                {sortConfig.key === "techCandidate" &&
                sortConfig.direction === "ascending"
                  ? "▼"
                  : "▲"}
              </button>
            </th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredApplications.map((app) => (
            <tr key={app.id}>
              <td>{app.fullName}</td>
              <td>{app.year}</td>
              <td>{app.major}</td>
              <td>{app.techCandidate ? "Tech" : "Non-tech"}</td>
              <td>
                <select
                  value={app.status}
                  onChange={(e) => updateStatus(app.id, e.target.value)}
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

  const PhasesView = () => (
    <div className="application-phases">
      {["Under Review", "Maybe", "Accepted", "Rejected"].map((status) => (
        <div
          key={status}
          className={`status-column ${status.toLowerCase().replace(" ", "-")}`}
        >
          <h3>{status}</h3>
          <div className="application-list">
            {applications
              .filter((app) => app.status === status)
              .map((app) => (
                <div key={app.id} className="application-card">
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

        {selectedTab === 0 ? <TableView /> : <PhasesView />}
      </div>

      {selectedApplication && (
        <ApplicationDetail
          application={selectedApplication}
          onClose={() => setSelectedApplication(null)}
          updateStatus={updateStatus}
          updateNotes={updateNotes}
        />
      )}
    </div>
  );
};

export default AssociatePage;
