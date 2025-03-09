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
git clone [repository-url]
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

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the ISC License.
