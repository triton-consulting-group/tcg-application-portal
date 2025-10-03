const mongoose = require('mongoose');
const Application = require('../models/Application');
require('dotenv').config();

// Sample data for generating realistic test applications
const sampleData = {
  firstNames: [
    'Alex', 'Jordan', 'Taylor', 'Casey', 'Morgan', 'Riley', 'Avery', 'Quinn', 'Blake', 'Cameron',
    'Drew', 'Emery', 'Finley', 'Hayden', 'Jamie', 'Kendall', 'Logan', 'Parker', 'Reese', 'Sage',
    'Skyler', 'Sydney', 'Tatum', 'River', 'Phoenix', 'Rowan', 'Sawyer', 'Ellis', 'Emery', 'Finley',
    'Harper', 'Indigo', 'Jules', 'Kai', 'Lane', 'Marlowe', 'Nico', 'Ocean', 'Peyton', 'Quinn',
    'Remy', 'Sage', 'Tierney', 'Vale', 'Wren', 'Zion', 'Aspen', 'Brook', 'Cedar', 'Dell'
  ],
  lastNames: [
    'Anderson', 'Brown', 'Davis', 'Garcia', 'Johnson', 'Jones', 'Martinez', 'Miller', 'Rodriguez', 'Smith',
    'Taylor', 'Thomas', 'Thompson', 'White', 'Williams', 'Wilson', 'Young', 'Adams', 'Allen', 'Baker',
    'Campbell', 'Carter', 'Clark', 'Collins', 'Cook', 'Cooper', 'Cox', 'Edwards', 'Evans', 'Flores',
    'Green', 'Hall', 'Harris', 'Hernandez', 'Hill', 'Jackson', 'King', 'Lee', 'Lewis', 'Lopez',
    'Martin', 'Moore', 'Nelson', 'Parker', 'Perez', 'Phillips', 'Roberts', 'Robinson', 'Sanchez', 'Scott'
  ],
  majors: [
    'Computer Science', 'Data Science', 'Mathematics', 'Statistics', 'Engineering', 'Business Administration',
    'Economics', 'Finance', 'Marketing', 'Psychology', 'Biology', 'Chemistry', 'Physics', 'Political Science',
    'International Relations', 'Communications', 'Journalism', 'English Literature', 'History', 'Art',
    'Music', 'Theater', 'Film Studies', 'Architecture', 'Urban Planning', 'Environmental Science',
    'Public Health', 'Nursing', 'Pre-Med', 'Pre-Law', 'Philosophy', 'Sociology', 'Anthropology',
    'Linguistics', 'Cognitive Science', 'Cognitive Science', 'Bioengineering', 'Mechanical Engineering',
    'Electrical Engineering', 'Civil Engineering', 'Aerospace Engineering', 'Industrial Engineering'
  ],
  studentYears: ['1st', '2nd', '3rd', '4th', '5th+', 'Graduate Student'],
  appliedBefore: ['Yes', 'No'],
  candidateTypes: ['Tech', 'Non-Tech'],
  statuses: [
    'Under Review', 'Case Night - Yes', 'Case Night - No', 
    'Final Interview - Yes', 'Final Interview - No', 'Final Interview - Maybe',
    'Accepted', 'Rejected'
  ],
  caseNightSlots: ['A', 'B', 'C'],
  reasons: [
    'I am passionate about consulting and want to develop my analytical skills.',
    'I want to gain real-world business experience and work with diverse clients.',
    'I am interested in solving complex problems and making strategic decisions.',
    'I want to network with professionals and build my career in consulting.',
    'I am excited about the opportunity to work on challenging case studies.',
    'I want to develop my presentation and communication skills.',
    'I am interested in learning about different industries and business models.',
    'I want to contribute to meaningful projects and make an impact.',
    'I am looking for opportunities to grow professionally and personally.',
    'I want to be part of a dynamic team and collaborative environment.'
  ],
  zombieAnswers: [
    'I would establish a secure base camp and coordinate rescue efforts.',
    'I would use my analytical skills to assess threats and develop survival strategies.',
    'I would focus on building alliances and maintaining communication networks.',
    'I would leverage technology to create early warning systems.',
    'I would organize supply chains and resource distribution.',
    'I would lead community defense initiatives and training programs.',
    'I would develop sustainable food production and water purification systems.',
    'I would create safe zones and evacuation protocols.',
    'I would use my problem-solving skills to adapt to changing circumstances.',
    'I would focus on maintaining hope and morale while ensuring practical survival needs.'
  ],
  additionalInfo: [
    'I have experience with data analysis and statistical modeling.',
    'I am fluent in multiple programming languages including Python and R.',
    'I have completed internships in business development and market research.',
    'I am involved in student government and leadership organizations.',
    'I have participated in case competitions and business plan competitions.',
    'I am passionate about social impact and sustainable business practices.',
    'I have experience working in cross-functional teams and collaborative environments.',
    'I am interested in emerging technologies and their business applications.',
    'I have strong presentation skills and experience with public speaking.',
    'I am committed to continuous learning and professional development.'
  ]
};

// Generate random data from arrays
const getRandomItem = (array) => array[Math.floor(Math.random() * array.length)];
const getRandomItems = (array, count) => {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

// Generate random email
const generateEmail = (firstName, lastName) => {
  const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'ucsd.edu', 'berkeley.edu', 'stanford.edu'];
  const domain = getRandomItem(domains);
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`;
};

// Generate random case night preferences
const generateCaseNightPreferences = () => {
  const numSlots = Math.floor(Math.random() * 3) + 1; // 1-3 slots
  return getRandomItems(sampleData.caseNightSlots, numSlots);
};

// Generate a single test application
const generateTestApplication = (index) => {
  const firstName = getRandomItem(sampleData.firstNames);
  const lastName = getRandomItem(sampleData.lastNames);
  const email = generateEmail(firstName, lastName);
  
  return {
    email: email,
    fullName: `${firstName} ${lastName}`,
    studentYear: getRandomItem(sampleData.studentYears),
    major: getRandomItem(sampleData.majors),
    appliedBefore: getRandomItem(sampleData.appliedBefore),
    candidateType: getRandomItem(sampleData.candidateTypes),
    reason: getRandomItem(sampleData.reasons),
    zombieAnswer: getRandomItem(sampleData.zombieAnswers),
    additionalInfo: getRandomItem(sampleData.additionalInfo),
    caseNightPreferences: generateCaseNightPreferences(),
    status: getRandomItem(sampleData.statuses),
    resume: `https://example.com/resumes/${firstName.toLowerCase()}-${lastName.toLowerCase()}-resume.pdf`,
    transcript: `https://example.com/transcripts/${firstName.toLowerCase()}-${lastName.toLowerCase()}-transcript.pdf`,
    image: `https://example.com/images/${firstName.toLowerCase()}-${lastName.toLowerCase()}-photo.jpg`,
    statusHistory: [
      {
        status: 'Under Review',
        changedBy: 'system',
        changedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within last 30 days
        notes: 'Application submitted'
      }
    ],
    comments: Math.random() > 0.7 ? [
      {
        comment: 'Strong candidate with relevant experience',
        commentedBy: 'admin@tcg.com',
        commentedAt: new Date(Date.now() - Math.random() * 15 * 24 * 60 * 60 * 1000),
        adminName: 'Admin User'
      }
    ] : []
  };
};

// Main function to generate test applications
const generateTestApplications = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Clear existing test applications (optional - comment out if you want to keep existing data)
    const existingCount = await Application.countDocuments();
    console.log(`Found ${existingCount} existing applications`);

    // Generate 100 test applications
    const testApplications = [];
    for (let i = 0; i < 100; i++) {
      testApplications.push(generateTestApplication(i));
    }

    // Insert test applications
    const result = await Application.insertMany(testApplications);
    console.log(`✅ Successfully created ${result.length} test applications`);

    // Display summary statistics
    const statusCounts = {};
    const candidateTypeCounts = {};
    const yearCounts = {};
    
    result.forEach(app => {
      statusCounts[app.status] = (statusCounts[app.status] || 0) + 1;
      candidateTypeCounts[app.candidateType] = (candidateTypeCounts[app.candidateType] || 0) + 1;
      yearCounts[app.studentYear] = (yearCounts[app.studentYear] || 0) + 1;
    });

    console.log("\n📊 Test Applications Summary:");
    console.log("=" .repeat(50));
    console.log("\n📈 Status Distribution:");
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

    console.log("\n👥 Candidate Type Distribution:");
    Object.entries(candidateTypeCounts).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    console.log("\n🎓 Student Year Distribution:");
    Object.entries(yearCounts).forEach(([year, count]) => {
      console.log(`  ${year}: ${count}`);
    });

    console.log("\n🎯 Case Night Preferences:");
    const allPreferences = result.flatMap(app => app.caseNightPreferences);
    const preferenceCounts = {};
    allPreferences.forEach(pref => {
      preferenceCounts[pref] = (preferenceCounts[pref] || 0) + 1;
    });
    Object.entries(preferenceCounts).forEach(([pref, count]) => {
      console.log(`  Slot ${pref}: ${count} applications`);
    });

    console.log("\n✅ Test data generation completed successfully!");

  } catch (error) {
    console.error("❌ Error generating test applications:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

// Run the script
console.log("🚀 Starting test application generation...");
generateTestApplications();
