# TCG Application Portal

A full-stack web application for managing TCG applications, built with React and Node.js.

## Project Overview

The TCG Application Portal is a modern web application that provides a platform for managing applications. It features a React frontend with Chakra UI for a beautiful, responsive interface, and a Node.js/Express backend with MongoDB for data persistence.

## Features

- User authentication and authorization
- Application submission and management
- File upload capabilities
- RESTful API backend
- Modern, responsive UI with Chakra UI
- MongoDB database integration

## Tech Stack

### Frontend

- React
- Chakra UI for components and styling
- React Router for navigation
- Axios for API requests
- Framer Motion for animations

### Backend

- Node.js
- Express.js
- MongoDB with Mongoose
- Multer for file uploads
- CORS enabled
- Environment variable support with dotenv

## Installation

1. Clone the repository:

```bash
git clone https://github.com/triton-consulting-group/tcg-application-portal
cd tcg-application-portal
```

2. Install backend dependencies:

```bash
cd backend
npm install
```

3. Install frontend dependencies:

```bash
cd ../frontend
npm install
```

4. Create a `.env` file in the backend directory with the following variables:

```
PORT=5002
MONGODB_URI=your_mongodb_connection_string
# Add any other required environment variables
```

## Running the Application

1. Start the backend server:

```bash
cd backend
npm start
```

2. In a new terminal, start the frontend development server:

```bash
cd frontend
npm start
```

The frontend will be available at `http://localhost:3000` and the backend at `http://localhost:5002`.

## Development

### Frontend Development

- The frontend is built with Create React App
- Use `npm start` to run the development server
- Use `npm run build` to create a production build

### Backend Development

- The backend API is built with Express.js
- Main server file is `server.js`
- API routes are in the `routes` directory
- Database models are in the `models` directory

## Project Structure

```
tcg-application-portal/
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
├── backend/
│   ├── config/
│   ├── models/
│   ├── routes/
│   ├── uploads/
│   ├── server.js
│   └── package.json
└── README.md
```

## Case Night Assignment System

The application includes a comprehensive case night assignment system that automatically groups applicants based on their preferences and manages the entire case night logistics.

### System Overview

The case night assignment system consists of:
- **Automatic group assignment** based on applicant preferences
- **Export functionality** for spreadsheet management
- **Email notification system** (ready for implementation)
- **Admin interface** for viewing and managing assignments

### Current Configuration

**File:** `backend/config/caseNightConfig.js`

```javascript
const CASE_NIGHT_CONFIG = {
  slots: {
    A: "6:00 PM-7:00 PM",
    B: "7:00 PM-8:00 PM", 
    C: "8:00 PM-9:00 PM"
  },
  maxCapacity: {
    tech: 200,     // Increased for current volume
    nonTech: 200   // Increased for current volume
  },
  date: "September 10th, 2025",
  groupSize: 4,    // Number of people per case group
  maxGroupsPerSlot: 50  // Maximum groups per time slot
};
```

### How the Assignment Algorithm Works

1. **Preference-Based Assignment**: Applicants are first assigned to their preferred time slots
2. **Group Formation**: Applicants are grouped into teams of 4 people
3. **Overflow Handling**: If preferred slots are full, applicants are assigned to available slots
4. **Balanced Distribution**: The algorithm ensures even distribution across time slots

### Running Case Group Assignments

#### Step 1: Assign Groups
```bash
cd backend
node scripts/assignCaseGroups.js
```

This script will:
- Clear existing assignments (optional)
- Process all applications with case night preferences
- Create groups of 4 people per time slot
- Generate a detailed summary report

#### Step 2: Export Assignments
```bash
cd backend
node scripts/exportCaseGroups.js
```

This creates a CSV file in `backend/exports/` with:
- Candidate type (Tech/Non-Tech)
- Time slot and group number
- Applicant details (name, email, major, etc.)
- Assignment metadata

### API Endpoints

The system provides several API endpoints for managing case groups:

- `GET /api/case-groups/assignments` - Get all assignments
- `GET /api/case-groups/summary` - Get assignment summary statistics
- `GET /api/case-groups/export` - Download CSV export
- `GET /api/case-groups/unassigned` - Get applications without assignments
- `GET /api/case-groups/groups/:candidateType/:timeSlot/:groupNumber` - Get specific group members

### Frontend Integration

#### Associate Portal
The associate portal now includes:
- **Export button** in the top navigation
- **Case night availability** displayed in application detail modals
- **Real-time export** functionality with progress indicators

#### Application Details Modal
When viewing individual applications, associates can see:
- Case night time slot preferences
- Visual badges for each available time slot
- Clear time labels (e.g., "6:00 PM-7:00 PM")

### Modifying Case Night Configuration

#### Changing Time Slots
Edit `backend/config/caseNightConfig.js`:
```javascript
slots: {
  A: "6:00 PM-7:00 PM",    // Change this time
  B: "7:00 PM-8:00 PM",    // Change this time
  C: "8:00 PM-9:00 PM",    // Change this time
  D: "9:00 PM-10:00 PM"    // Add new slot
}
```

#### Adjusting Capacity
```javascript
maxCapacity: {
  tech: 300,     // Increase for larger events
  nonTech: 300
},
groupSize: 4,    // Change group size if needed
maxGroupsPerSlot: 75  // Adjust based on capacity
```

#### Changing the Date
Update the date in multiple locations:
1. `backend/config/caseNightConfig.js` - `date: "September 10th, 2025"`
2. `frontend/src/Pages/ApplicationComponents/ApplicationForm.js` - `const caseNightDate = "September 10th, 2025"`

### Data Management

#### Database Schema
The system uses a `CaseGroupAssignment` model that stores:
- Application reference and applicant details
- Time slot and group assignment
- Email notification status
- Assignment metadata and notes

#### Export Format
The CSV export includes:
- Candidate Type (Tech/Non-Tech)
- Time Slot (e.g., "6:00 PM-7:00 PM")
- Group Number and Group ID
- Applicant Name, Email, Major, Student Year
- Applied Before status and Assignment Status
- Assignment timestamp

### Troubleshooting

#### Common Issues

1. **"No assignments found"** - Run the assignment script first
2. **"Duplicate key error"** - Clear existing assignments before re-running
3. **"Schema not registered"** - Ensure all models are properly imported

#### Reset Assignments
To clear all assignments and start fresh:
```bash
cd backend
node scripts/resetCaseGroups.js
node scripts/assignCaseGroups.js
```

### Future Enhancements

The system is designed to support:
- **Email notifications** to applicants with their case night details
- **Manual assignment adjustments** through the admin interface
- **Real-time group management** and member swapping
- **Integration with calendar systems** for automated scheduling

## Application Deadline Management

The application portal includes automatic deadline enforcement to prevent submissions after the specified deadline.

### Configuration

**File:** `backend/config/deadlineConfig.js`

```javascript
const DEADLINE_CONFIG = {
  // Application deadline: Saturday noon EST (2 days after Thursday info night)
  applicationDeadline: "2025-09-14T12:00:00-05:00", // Saturday noon EST
  isActive: true, // Easy toggle for testing/debugging
  message: "Applications are now closed. Thank you for your interest in TCG!",
  
  // Timezone information for reference
  timezone: "EST (Eastern Standard Time)",
  
  // Future cycles: Update the applicationDeadline date above
  // Format: YYYY-MM-DDTHH:mm:ss-HH:mm (ISO 8601 with timezone)
  // Example: "2026-09-12T12:00:00-05:00" for next year
};
```

### How It Works

1. **Backend Validation**: The application submission route checks the deadline before processing
2. **Frontend Prevention**: The application form disables submission and shows a closed message
3. **User Experience**: Clear messaging when applications are closed
4. **Easy Updates**: Simply update the date in the config file for future cycles

### Updating for Future Cycles

To update the deadline for a new application cycle:

1. **Update the deadline date** in `backend/config/deadlineConfig.js`
2. **Deploy the changes**
3. **Test the deadline enforcement** (set `isActive: false` temporarily for testing)

### Testing Deadline Functionality

- Set `isActive: false` in the config to disable deadline checking
- Temporarily set a past date to test the closed state
- The system will show "Applications Closed" message and disable the submit button

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
