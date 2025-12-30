const mongoose = require("mongoose");

const AdminSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  name: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    enum: ["admin", "super_admin"], 
    default: "admin" 
  },
  permissions: {
    canViewApplications: { type: Boolean, default: true },
    canEditApplications: { type: Boolean, default: true },
    canDeleteApplications: { type: Boolean, default: false },
    canManageAdmins: { type: Boolean, default: false },
    canViewAnalytics: { type: Boolean, default: true },
    canChangeStatus: { type: Boolean, default: true },
    canAddComments: { type: Boolean, default: true },
    canDragDrop: { type: Boolean, default: true }
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  lastLogin: { 
    type: Date 
  },
  createdBy: { 
    type: String 
  }
}, { timestamps: true });

module.exports = mongoose.model("Admin", AdminSchema); 