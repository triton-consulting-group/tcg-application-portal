import React, { useState, useEffect } from "react";
import dashboardApi, { getFileUrl } from "./api";

// Feature flag: if true, show an inline status <select> in the "View Applicant" modal
// Set to false to revert to the original display (plain status badge/span).
const ENABLE_INLINE_STATUS_IN_MODAL = true;

// 🟢 **ApplicationDetail Component (Updated)**
const ApplicationDetail = ({ application, onClose, caseNightConfig, adminInfo, updateStatus, onCommentsChange }) => {
  const [comments, setComments] = useState(application.comments || []);
  const [deletingCommentIds, setDeletingCommentIds] = useState([]);
  const canDeleteComments = adminInfo?.role === "super_admin" || !!adminInfo?.permissions?.canDeleteComments;

  // Runs one change on both copies of the comments: this modal's list and the parent's
  // application list (which the kanban badges read). `updater` maps old comments -> new comments.
  const applyCommentsUpdate = (updater) => {
    setComments(updater);
    onCommentsChange?.(application._id, updater);
  };
  // Local, optimistic status so the modal updates immediately when admin changes status.
  const [localStatus, setLocalStatus] = useState(application.status || "Under Review");

  useEffect(() => {
    setLocalStatus(application.status || "Under Review");
  }, [application.status]);
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
      const response = await dashboardApi.addComment(application._id, newComment);

      if (response.data) {
        applyCommentsUpdate(prev => [...prev, response.data.comment]);
        setNewComment("");
      }
    } catch (error) {
      console.error("Error adding comment:", error);
      alert("Failed to add comment. Please try again.");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!canDeleteComments) {
      alert("❌ You don't have permission to delete comments.");
      return;
    }
    if (!window.confirm("Delete this comment? This cannot be undone.")) return;

    setDeletingCommentIds(prev => [...prev, commentId]);
    try {
      await dashboardApi.deleteComment(application._id, commentId);
      applyCommentsUpdate(prev => prev.filter(c => c._id !== commentId));
    } catch (error) {
      console.error("Error deleting comment:", error);
      alert(error.response?.data?.error || "Failed to delete comment. Please try again.");
    } finally {
      setDeletingCommentIds(prev => prev.filter(id => id !== commentId));
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
              {ENABLE_INLINE_STATUS_IN_MODAL ? (
                <select
                  value={localStatus}
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    setLocalStatus(newStatus);
                    // Call parent's updateStatus handler (already does permission check & API call)
                    if (typeof updateStatus === "function") {
                      updateStatus(application._id, newStatus);
                    }
                  }}
                  disabled={!(adminInfo?.role === "super_admin" || adminInfo?.permissions?.canChangeStatus)}
                  style={{
                    marginLeft: "8px",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    cursor: (adminInfo?.role === "super_admin" || adminInfo?.permissions?.canChangeStatus) ? "pointer" : "not-allowed",
                    opacity: (adminInfo?.role === "super_admin" || adminInfo?.permissions?.canChangeStatus) ? 1 : 0.6
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
              ) : (
                <span style={{
                  backgroundColor:
                    application.status === "Under Review" ? "#808080" :
                      (application.status.includes("Yes") || application.status === "Accepted") ? "#3bb143" :
                        (application.status.includes("No") || application.status === "Rejected") ? "#c21807" :
                          "#6c757d",
                  color: "white",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  marginLeft: "8px",
                  fontSize: "12px"
                }}>
                  {application.status}
                </span>
              )}
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
              <button
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
                  fontSize: "14px",
                  border: "none",
                  cursor: "pointer"
                }}
              >
                View Resume
              </button>
              <button
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
                  fontSize: "14px",
                  cursor: "pointer",
                  border: "none"
                }}
              >
                View Transcript
              </button>
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
                  backgroundColor: ((newComment.trim() && !isSubmittingComment) && adminInfo?.permissions?.canAddComments) ? "#007bff" : "#6c757d",
                  color: "white",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "4px",
                  cursor: ((newComment.trim() && !isSubmittingComment) && adminInfo?.permissions?.canAddComments) ? "pointer" : "not-allowed",
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
              comments.slice().reverse().map((comment) => (
                <div
                  key={comment._id}
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
                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "12px", color: "#6c757d" }}>
                        {new Date(comment.commentedAt).toLocaleString()}
                      </span>
                      {canDeleteComments && (
                        <button
                          onClick={() => handleDeleteComment(comment._id)}
                          disabled={deletingCommentIds.includes(comment._id)}
                          aria-label={`Delete comment by ${comment.adminName}`}
                          style={{
                            backgroundColor: "transparent",
                            color: "#dc3545",
                            border: "1px solid #dc3545",
                            borderRadius: "4px",
                            padding: "2px 8px",
                            fontSize: "12px",
                            cursor: deletingCommentIds.includes(comment._id) ? "not-allowed" : "pointer",
                            opacity: deletingCommentIds.includes(comment._id) ? 0.6 : 1
                          }}
                        >
                          {deletingCommentIds.includes(comment._id) ? "Deleting..." : "Delete"}
                        </button>
                      )}
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

export default ApplicationDetail;
