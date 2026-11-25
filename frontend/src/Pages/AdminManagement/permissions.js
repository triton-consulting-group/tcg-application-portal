export const PERMISSIONS = [
  { key: "canChangeStatus", label: "Change application status", description: "Update statuses and move applicants between phases." },
  { key: "canAddComments", label: "Add comments", description: "Add internal comments to applications." },
  { key: "canDeleteComments", label: "Delete comments", description: "Remove internal application comments." },
  { key: "canManageAdmins", label: "Manage admins", description: "Manage ordinary admin accounts. Only super admins can grant this access." },
];

export const LEGACY_PERMISSIONS = [
  { key: "canViewApplications", label: "View applications" },
  { key: "canEditApplications", label: "Edit applications" },
  { key: "canDeleteApplications", label: "Delete applications" },
  { key: "canViewAnalytics", label: "View analytics" },
  { key: "canDragDrop", label: "Drag and drop" },
];

// Match the existing Admin model's defaults; do not reset older flags when editing.
export const DEFAULT_PERMISSIONS = {
  canViewApplications: true, canEditApplications: true, canDeleteApplications: false,
  canManageAdmins: false, canViewAnalytics: true, canChangeStatus: true,
  canAddComments: true, canDeleteComments: true, canDragDrop: true,
};

export const roleLabel = (role) => role === "super_admin" ? "Super admin" : "Admin";
export const canManage = (admin) => !!admin?.isActive && (
  admin.role === "super_admin" || !!admin.permissions?.canManageAdmins
);
export const canEdit = (caller, target) => canManage(caller) && (
  target.role !== "super_admin" || caller.role === "super_admin"
);
export const canChangeActive = (caller, target) => canEdit(caller, target) && caller.email !== target.email;

export const errorMessage = (error, fallback) => {
  const message = error.response?.data?.error;
  return typeof message === "string" ? message : fallback;
};
