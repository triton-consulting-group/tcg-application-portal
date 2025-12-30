import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import API_BASE_URL from "../config/api";

const AdminManagementPage = () => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [newAdmin, setNewAdmin] = useState({
    email: "",
    name: "",
    role: "admin",
    permissions: {
      canViewApplications: true,
      canEditApplications: true,
      canDeleteApplications: false,
      canManageAdmins: false,
      canViewAnalytics: true
    }
  });

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const response = await axios.get("${API_BASE_URL}/api/admin", {
        data: { email: localStorage.getItem("adminEmail") }
      });
      setAdmins(response.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching admins:", error);
      setError("Failed to fetch admins");
      setLoading(false);
    }
  };

  const handleCreateAdmin = async () => {
    try {
      await axios.post("${API_BASE_URL}/api/admin", {
        ...newAdmin,
        email: localStorage.getItem("adminEmail")
      });
      
      setNewAdmin({
        email: "",
        name: "",
        role: "admin",
        permissions: {
          canViewApplications: true,
          canEditApplications: true,
          canDeleteApplications: false,
          canManageAdmins: false,
          canViewAnalytics: true
        }
      });
      
      setShowModal(false);
      fetchAdmins();
    } catch (error) {
      console.error("Error creating admin:", error);
      alert("Failed to create admin");
    }
  };

  const handleDeactivateAdmin = async (email) => {
    if (window.confirm(`Are you sure you want to deactivate ${email}?`)) {
      try {
        await axios.delete(`${API_BASE_URL}/api/admin/${email}`, {
          data: { email: localStorage.getItem("adminEmail") }
        });
        fetchAdmins();
      } catch (error) {
        console.error("Error deactivating admin:", error);
        alert("Failed to deactivate admin");
      }
    }
  };

  const handlePermissionChange = (permission, checked) => {
    setNewAdmin(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permission]: checked
      }
    }));
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "24px", marginTop: "40px" }}>
        <p>Loading admin management...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "24px", marginTop: "40px" }}>
        <div style={{ 
          backgroundColor: "#fed7d7", 
          color: "#c53030", 
          padding: "12px", 
          borderRadius: "6px", 
          marginBottom: "16px",
          border: "1px solid #feb2b2"
        }}>
          ❌ {error}
        </div>
        <button 
          onClick={() => navigate("/associate")}
          style={{
            backgroundColor: "#3182ce",
            color: "white",
            border: "none",
            padding: "8px 16px",
            borderRadius: "6px",
            cursor: "pointer"
          }}
        >
          Return to Associate Page
        </button>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "#f7fafc", minHeight: "100vh", padding: "24px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ fontSize: "32px", fontWeight: "bold", margin: "0" }}>
            Admin Management
          </h1>
          <div style={{ display: "flex", gap: "12px" }}>
            <button 
              onClick={() => setShowModal(true)}
              style={{
                backgroundColor: "#3182ce",
                color: "white",
                border: "none",
                padding: "8px 16px",
                borderRadius: "6px",
                cursor: "pointer"
              }}
            >
              Add New Admin
            </button>
            <button 
              onClick={() => navigate("/associate")}
              style={{
                backgroundColor: "#718096",
                color: "white",
                border: "none",
                padding: "8px 16px",
                borderRadius: "6px",
                cursor: "pointer"
              }}
            >
              Back to Associate Page
            </button>
          </div>
        </div>

        <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "8px", boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "bold" }}>Name</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "bold" }}>Email</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "bold" }}>Role</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "bold" }}>Status</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "bold" }}>Last Login</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "bold" }}>Permissions</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "bold" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.email} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "12px" }}>{admin.name}</td>
                  <td style={{ padding: "12px" }}>{admin.email}</td>
                  <td style={{ padding: "12px" }}>
                    <span style={{
                      backgroundColor: admin.role === "super_admin" ? "#e53e3e" : "#3182ce",
                      color: "white",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: "bold"
                    }}>
                      {admin.role}
                    </span>
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span style={{
                      backgroundColor: admin.isActive ? "#38a169" : "#e53e3e",
                      color: "white",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: "bold"
                    }}>
                      {admin.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: "12px" }}>
                    {admin.lastLogin 
                      ? new Date(admin.lastLogin).toLocaleDateString()
                      : "Never"
                    }
                  </td>
                  <td style={{ padding: "12px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {Object.entries(admin.permissions).map(([key, value]) => (
                        <p key={key} style={{ fontSize: "14px", margin: "0" }}>
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: {value ? "✅" : "❌"}
                        </p>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: "12px" }}>
                    {admin.isActive && admin.role !== "super_admin" && (
                      <button 
                        onClick={() => handleDeactivateAdmin(admin.email)}
                        style={{
                          backgroundColor: "#e53e3e",
                          color: "white",
                          border: "none",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "12px"
                        }}
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add New Admin Modal */}
        {showModal && (
          <div
            style={{
              position: "fixed",
              top: "0",
              left: "0",
              right: "0",
              bottom: "0",
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              zIndex: "1000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "24px",
                borderRadius: "8px",
                maxWidth: "500px",
                width: "90%",
                maxHeight: "90vh",
                overflowY: "auto"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: "0" }}>Add New Admin</h2>
                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    backgroundColor: "transparent",
                    border: "none",
                    fontSize: "18px",
                    cursor: "pointer",
                    padding: "4px"
                  }}
                >
                  ✕
                </button>
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ width: "100%" }}>
                  <p style={{ fontWeight: "bold", marginBottom: "8px", margin: "0" }}>Email *</p>
                  <input
                    type="email"
                    value={newAdmin.email}
                    onChange={(e) => setNewAdmin({...newAdmin, email: e.target.value})}
                    placeholder="admin@example.com"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: "6px",
                      fontSize: "14px"
                    }}
                    required
                  />
                </div>

                <div style={{ width: "100%" }}>
                  <p style={{ fontWeight: "bold", marginBottom: "8px", margin: "0" }}>Name *</p>
                  <input
                    type="text"
                    value={newAdmin.name}
                    onChange={(e) => setNewAdmin({...newAdmin, name: e.target.value})}
                    placeholder="Admin Name"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: "6px",
                      fontSize: "14px"
                    }}
                    required
                  />
                </div>

                <div style={{ width: "100%" }}>
                  <p style={{ fontWeight: "bold", marginBottom: "8px", margin: "0" }}>Role</p>
                  <select
                    value={newAdmin.role}
                    onChange={(e) => setNewAdmin({...newAdmin, role: e.target.value})}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: "6px",
                      fontSize: "14px"
                    }}
                  >
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>

                <div style={{ width: "100%" }}>
                  <p style={{ fontWeight: "bold", marginBottom: "8px", margin: "0" }}>Permissions</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={newAdmin.permissions.canViewApplications}
                        onChange={(e) => handlePermissionChange("canViewApplications", e.target.checked)}
                        style={{ marginRight: "8px" }}
                      />
                      Can View Applications
                    </label>
                    <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={newAdmin.permissions.canEditApplications}
                        onChange={(e) => handlePermissionChange("canEditApplications", e.target.checked)}
                        style={{ marginRight: "8px" }}
                      />
                      Can Edit Applications
                    </label>
                    <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={newAdmin.permissions.canDeleteApplications}
                        onChange={(e) => handlePermissionChange("canDeleteApplications", e.target.checked)}
                        style={{ marginRight: "8px" }}
                      />
                      Can Delete Applications
                    </label>
                    <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={newAdmin.permissions.canManageAdmins}
                        onChange={(e) => handlePermissionChange("canManageAdmins", e.target.checked)}
                        style={{ marginRight: "8px" }}
                      />
                      Can Manage Admins
                    </label>
                    <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={newAdmin.permissions.canViewAnalytics}
                        onChange={(e) => handlePermissionChange("canViewAnalytics", e.target.checked)}
                        style={{ marginRight: "8px" }}
                      />
                      Can View Analytics
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px" }}>
                <button 
                  onClick={() => setShowModal(false)}
                  style={{
                    backgroundColor: "transparent",
                    border: "1px solid #e2e8f0",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateAdmin}
                  style={{
                    backgroundColor: "#3182ce",
                    color: "white",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    cursor: "pointer"
                  }}
                >
                  Create Admin
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminManagementPage; 