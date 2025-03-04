import React from "react";
import { Provider } from "./components/ui/provider";
import Navbar from "./components/ui/Navbar";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./Pages/HomePage";
import ApplicationPage from "./Pages/ApplicationPage";
import AssociatePage from "./Pages/AssociatePage";

const App = () => {
  return (
    <Provider>
      <Router>
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/application" element={<ApplicationPage />} />
          <Route path="/associate" element={<AssociatePage />} />
        </Routes>
      </Router>
    </Provider>
  );
};

export default App;