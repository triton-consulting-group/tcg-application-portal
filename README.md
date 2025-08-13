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

## Case Night Configuration

The application includes a configurable case night system that allows easy modification of time slots and dates.

### Modifying Case Night Times

To change the case night time slots, edit the configuration file:

**File:** `backend/config/caseNightConfig.js`

```javascript
const CASE_NIGHT_CONFIG = {
  slots: {
    A: "6:00 PM-7:00 PM",    // Change this time
    B: "7:00 PM-8:00 PM",    // Change this time
    C: "8:00 PM-9:00 PM"     // Change this time
  },
  maxCapacity: {
    tech: 12,      // 3 groups of 4
    nonTech: 12    // 3 groups of 4
  },
  date: "September 10th, 2025"  // Change this date
};
```

### How It Works

1. **Slot IDs**: The system uses simple IDs (A, B, C) internally for easy algorithm processing
2. **Display Names**: The frontend shows human-readable times (e.g., "6:00 PM-7:00 PM")
3. **Data Storage**: User preferences are stored as arrays of slot IDs (e.g., ["A", "C"])
4. **API Endpoint**: The configuration is available via `GET /api/applications/case-night-config`

### Adding More Time Slots

To add additional time slots:

1. Add a new entry to the `slots` object in `caseNightConfig.js`:
   ```javascript
   slots: {
     A: "6:00 PM-7:00 PM",
     B: "7:00 PM-8:00 PM", 
     C: "8:00 PM-9:00 PM",
     D: "9:00 PM-10:00 PM"  // New slot
   }
   ```

2. Update the capacity limits if needed:
   ```javascript
   maxCapacity: {
     tech: 16,      // Increased for 4 slots
     nonTech: 16
   }
   ```

### Case Night Date

The case night date is currently hardcoded in the frontend. To change it:

**File:** `frontend/src/Pages/ApplicationComponents/ApplicationForm.js` (line 19)
```javascript
const caseNightDate = "September 10th, 2025"; // Change this date
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
