const mongoose = require('mongoose');
const Application = require('../models/Application');
require('dotenv').config();

// 5 realistic applicants with proper form field values
const testApplications = [
  {
    email: "sarah.chen@ucsd.edu",
    fullName: "Sarah Chen",
    studentYear: "3rd",
    major: "Data Science",
    appliedBefore: "No",
    candidateType: "Tech",
    reason: "I'm passionate about using data to solve real-world business problems. TCG's focus on analytical consulting aligns perfectly with my career goals. I want to develop my skills in statistical modeling and data visualization while working on meaningful projects with diverse clients. The collaborative environment and opportunity to learn from experienced consultants is exactly what I'm looking for.",
    zombieAnswer: "I would establish a secure base camp, coordinate rescue efforts, and maintain communication networks.",
    additionalInfo: "I have experience with Python, R, and SQL. Completed a data science internship last summer where I built predictive models for customer behavior.",
    caseNightPreferences: ["A", "B"],
    status: "Under Review",
    statusHistory: [
      {
        status: "Under Review",
        changedBy: "system@tcg.com",
        changedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        notes: "Application submitted"
      }
    ],
    comments: [
      {
        comment: "Strong technical background. Good fit for tech track.",
        commentedBy: "admin@tcg.com",
        commentedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        adminName: "Admin User"
      }
    ]
  },
  {
    email: "michael.rodriguez@ucsd.edu",
    fullName: "Michael Rodriguez",
    studentYear: "2nd",
    major: "Business Administration",
    appliedBefore: "Yes",
    candidateType: "Non-Tech",
    reason: "I applied to TCG last year and was impressed by the organization's commitment to professional development. This year, I've gained more experience through my business courses and a marketing internship. I'm particularly interested in TCG's case study approach and the opportunity to work with real clients. I believe I can contribute fresh perspectives while learning from the team.",
    zombieAnswer: "I would organize supply chains, build alliances, and create safe zones.",
    additionalInfo: "Member of Business Club and participated in case competitions. Strong presentation and communication skills.",
    caseNightPreferences: ["B", "C"],
    status: "Case Night - Yes",
    statusHistory: [
      {
        status: "Under Review",
        changedBy: "admin@tcg.com",
        changedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        notes: "Application submitted"
      },
      {
        status: "Case Night - Yes",
        changedBy: "admin@tcg.com",
        changedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        notes: "Moved to case night"
      }
    ],
    comments: [
      {
        comment: "Re-applicant with good growth. Strong communication skills.",
        commentedBy: "admin@tcg.com",
        commentedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
        adminName: "Admin User"
      },
      {
        comment: "Performed well in case night. Good analytical thinking.",
        commentedBy: "admin@tcg.com",
        commentedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        adminName: "Admin User"
      }
    ]
  },
  {
    email: "emily.wang@ucsd.edu",
    fullName: "Emily Wang",
    studentYear: "4th",
    major: "Computer Science",
    appliedBefore: "No",
    candidateType: "Tech",
    reason: "As a senior computer science student, I want to apply my technical skills to solve business problems. TCG offers the perfect bridge between technology and consulting. I'm excited about working on case studies that require both analytical thinking and technical expertise. The collaborative environment and mentorship opportunities are exactly what I need as I prepare for my career.",
    zombieAnswer: "I would leverage technology to create early warning systems and coordinate defense.",
    additionalInfo: "Proficient in Java, Python, and JavaScript. Completed software engineering internship. Interested in fintech consulting.",
    caseNightPreferences: ["A"],
    status: "Final Interview - Yes",
    statusHistory: [
      {
        status: "Under Review",
        changedBy: "system@tcg.com",
        changedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        notes: "Application submitted"
      },
      {
        status: "Case Night - Yes",
        changedBy: "admin@tcg.com",
        changedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
        notes: "Moved to case night"
      },
      {
        status: "Final Interview - Yes",
        changedBy: "admin@tcg.com",
        changedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        notes: "Strong performance in case night"
      }
    ],
    comments: [
      {
        comment: "Excellent technical skills. Strong problem-solving approach in case night.",
        commentedBy: "admin@tcg.com",
        commentedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
        adminName: "Admin User"
      },
      {
        comment: "Great communication. Would be a strong addition to the team.",
        commentedBy: "admin@tcg.com",
        commentedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
        adminName: "Admin User"
      },
      {
        comment: "Scheduled final interview for next week.",
        commentedBy: "admin@tcg.com",
        commentedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        adminName: "Admin User"
      }
    ]
  },
  {
    email: "james.kim@ucsd.edu",
    fullName: "James Kim",
    studentYear: "1st",
    major: "Economics",
    appliedBefore: "No",
    candidateType: "Non-Tech",
    reason: "I'm a first-year student eager to get involved in consulting early in my college career. TCG's focus on professional development and real-world experience is exactly what I'm looking for. I want to learn about different industries, develop my analytical skills, and work with a team of motivated students. Even though I'm new to consulting, I'm a fast learner and very committed.",
    zombieAnswer: "I would focus on building alliances and maintaining communication networks.",
    additionalInfo: "New to consulting but very motivated. Strong academic performance in high school. Looking forward to learning.",
    caseNightPreferences: ["C"],
    status: "Under Review",
    statusHistory: [
      {
        status: "Under Review",
        changedBy: "system@tcg.com",
        changedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        notes: "Application submitted"
      }
    ],
    comments: [] // No comments yet
  },
  {
    email: "priya.patel@ucsd.edu",
    fullName: "Priya Patel",
    studentYear: "5th+",
    major: "Cognitive Science",
    appliedBefore: "Yes",
    candidateType: "Non-Tech",
    reason: "As a fifth-year student, I've had the opportunity to explore various fields and I've found that consulting combines my interests in psychology, business, and problem-solving. I applied to TCG last year and learned a lot from the process. This year, I'm more prepared and excited to contribute. I'm particularly interested in healthcare consulting and using behavioral insights to solve business challenges.",
    zombieAnswer: "I would use my problem-solving skills to adapt to changing circumstances.",
    additionalInfo: "Research experience in cognitive psychology. Strong background in statistics and experimental design. Interested in behavioral consulting.",
    caseNightPreferences: ["A", "B", "C"],
    status: "Accepted",
    statusHistory: [
      {
        status: "Under Review",
        changedBy: "system@tcg.com",
        changedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
        notes: "Application submitted"
      },
      {
        status: "Case Night - Yes",
        changedBy: "admin@tcg.com",
        changedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), // 12 days ago
        notes: "Moved to case night"
      },
      {
        status: "Final Interview - Yes",
        changedBy: "admin@tcg.com",
        changedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000), // 9 days ago
        notes: "Strong case night performance"
      },
      {
        status: "Accepted",
        changedBy: "admin@tcg.com",
        changedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        notes: "Excellent interview. Welcome to TCG!"
      }
    ],
    comments: [
      {
        comment: "Re-applicant with strong growth. Unique background in cognitive science.",
        commentedBy: "admin@tcg.com",
        commentedAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000), // 11 days ago
        adminName: "Admin User"
      },
      {
        comment: "Outstanding performance in case night. Creative problem-solving approach.",
        commentedBy: "admin@tcg.com",
        commentedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
        adminName: "Admin User"
      },
      {
        comment: "Excellent final interview. Great fit for the team. Highly recommend acceptance.",
        commentedBy: "admin@tcg.com",
        commentedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        adminName: "Admin User"
      }
    ]
  }
];

const populate5Applicants = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Check if any of these emails already exist
    const existingEmails = testApplications.map(app => app.email);
    const existingApps = await Application.find({ email: { $in: existingEmails } });
    
    if (existingApps.length > 0) {
      console.log(`⚠️  Found ${existingApps.length} existing applications with these emails:`);
      existingApps.forEach(app => {
        console.log(`   - ${app.email} (${app.fullName})`);
      });
      console.log("\n💡 To avoid duplicates, you can:");
      console.log("   1. Delete existing applications first");
      console.log("   2. Modify the email addresses in this script");
      console.log("   3. Continue anyway (will create duplicates)\n");
    }

    // Insert test applications
    const result = await Application.insertMany(testApplications, { ordered: false });
    console.log(`\n✅ Successfully inserted ${result.length} applications`);

    // Display summary
    console.log("\n📊 Summary:");
    console.log("=" .repeat(50));
    
    result.forEach((app, index) => {
      console.log(`\n${index + 1}. ${app.fullName}`);
      console.log(`   Email: ${app.email}`);
      console.log(`   Year: ${app.studentYear} | Major: ${app.major}`);
      console.log(`   Type: ${app.candidateType} | Applied Before: ${app.appliedBefore}`);
      console.log(`   Status: ${app.status}`);
      console.log(`   Comments: ${app.comments.length}`);
      console.log(`   Case Night: ${app.caseNightPreferences.map(slot => {
        const caseNightConfig = require('../config/caseNightConfig');
        return caseNightConfig.slots[slot];
      }).join(', ')}`);
    });

    // Statistics
    const techCount = result.filter(app => app.candidateType === "Tech").length;
    const nonTechCount = result.filter(app => app.candidateType === "Non-Tech").length;
    const withComments = result.filter(app => app.comments.length > 0).length;
    
    console.log("\n📈 Statistics:");
    console.log(`   Tech candidates: ${techCount}`);
    console.log(`   Non-Tech candidates: ${nonTechCount}`);
    console.log(`   Applications with comments: ${withComments}`);
    console.log(`   Total applications: ${result.length}`);

    console.log("\n✅ Done! You can now test the comment icon feature on the phases page.");

  } catch (error) {
    if (error.code === 11000) {
      console.error("❌ Duplicate email error. Some applications with these emails already exist.");
      console.error("   Modify the email addresses in the script or delete existing applications first.");
    } else {
      console.error("❌ Error populating applications:", error);
    }
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
};

// Run the script
console.log("🚀 Starting to populate 5 test applicants...\n");
populate5Applicants();