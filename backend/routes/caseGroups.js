const express = require("express");
const router = express.Router();
const CaseGroupAssignment = require("../models/CaseGroupAssignment");
const Application = require("../models/Application");

// 🟢 Get all case group assignments
router.get("/assignments", async (req, res) => {
  try {
    const assignments = await CaseGroupAssignment.find()
      .populate('applicationId')
      .sort({ candidateType: 1, timeSlot: 1, groupNumber: 1 });

    res.json(assignments);
  } catch (error) {
    console.error("Error fetching case group assignments:", error);
    res.status(500).json({ error: "Failed to fetch assignments" });
  }
});

// 🟢 Get case group assignments summary
router.get("/summary", async (req, res) => {
  try {
    const summary = await CaseGroupAssignment.aggregate([
      {
        $group: {
          _id: {
            candidateType: "$candidateType",
            timeSlot: "$timeSlot"
          },
          count: { $sum: 1 },
          groups: { $addToSet: "$groupNumber" }
        }
      },
      {
        $sort: { "_id.candidateType": 1, "_id.timeSlot": 1 }
      }
    ]);

    res.json(summary);
  } catch (error) {
    console.error("Error fetching case group summary:", error);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

// 🟢 Get assignments by group
router.get("/groups/:candidateType/:timeSlot/:groupNumber", async (req, res) => {
  try {
    const { candidateType, timeSlot, groupNumber } = req.params;
    
    const groupMembers = await CaseGroupAssignment.find({
      candidateType,
      timeSlot,
      groupNumber: parseInt(groupNumber)
    }).populate('applicationId');

    res.json(groupMembers);
  } catch (error) {
    console.error("Error fetching group members:", error);
    res.status(500).json({ error: "Failed to fetch group members" });
  }
});

// 🟢 Export case groups to CSV
router.get("/export", async (req, res) => {
  try {
    const assignments = await CaseGroupAssignment.find()
      .populate('applicationId')
      .sort({ candidateType: 1, timeSlot: 1, groupNumber: 1 });

    if (assignments.length === 0) {
      return res.status(404).json({ error: "No assignments found" });
    }

    // Create CSV content
    const csvHeaders = [
      'Candidate Type',
      'Time Slot',
      'Group Number',
      'Group ID',
      'Applicant Name',
      'Email',
      'Major',
      'Student Year',
      'Applied Before',
      'Status',
      'Assigned At'
    ];

    const csvRows = [csvHeaders.join(',')];

    assignments.forEach(assignment => {
      const row = [
        assignment.candidateType,
        assignment.timeSlotDisplay,
        assignment.groupNumber,
        assignment.groupId,
        `"${assignment.applicantName}"`, // Wrap in quotes to handle commas in names
        assignment.applicantEmail,
        `"${assignment.applicationId?.major || ''}"`,
        assignment.applicationId?.studentYear || '',
        assignment.applicationId?.appliedBefore || '',
        assignment.status,
        new Date(assignment.assignedAt).toLocaleString()
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');

    // Set response headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="case-group-assignments-${new Date().toISOString().split('T')[0]}.csv"`);
    
    res.send(csvContent);

  } catch (error) {
    console.error("Error exporting case groups:", error);
    res.status(500).json({ error: "Failed to export case groups" });
  }
});

// 🟢 Get unassigned applications (for reference)
router.get("/unassigned", async (req, res) => {
  try {
    const unassigned = await Application.find({
      _id: { $nin: await CaseGroupAssignment.distinct('applicationId') },
      candidateType: { $in: ["Tech", "Non-Tech"] }
    }).select('email fullName candidateType caseNightPreferences');

    res.json(unassigned);
  } catch (error) {
    console.error("Error fetching unassigned applications:", error);
    res.status(500).json({ error: "Failed to fetch unassigned applications" });
  }
});

module.exports = router;
