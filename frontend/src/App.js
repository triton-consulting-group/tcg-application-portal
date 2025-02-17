import React from "react"
import { Provider } from "./components/ui/provider"
import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import ApplicationPage from "./Pages/ApplicationPage"

const App = () => {
  return (
    <Provider> 
      <Router>
        <Routes>
          <Route path="/" element={<ApplicationPage />} />
        </Routes>
      </Router>
    </Provider>
  )
}

export default App



