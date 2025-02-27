import React from "react"
import { Provider } from "./components/ui/provider"
import Navbar from "./components/ui/Navbar";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import HomePage from "./Pages/Homepage"
import ApplicationPage from "./Pages/ApplicationPage"

const App = () => {
  return (
    <Provider> 
      <Router> 
        <Navbar />
        <Routes>
        <Route path="/" element={<ApplicationPage />} />
          <Route path="/Application" element={<ApplicationPage />} />
        </Routes>
      </Router>
    </Provider>
  )
}

export default App;