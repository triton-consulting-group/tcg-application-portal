import React from "react";
import { Provider } from "./components/ui/provider";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./Pages/HomePage";
import ApplicationPage from "./Pages/ApplicationPage";
import AssociatePage from "./Pages/AssociatePage";
import SuccessPage from "./Pages/SuccessPage";

const App = () => {
  return (
    <Provider> 
      <Router> 
        <Routes>
        <Route path="/" element={<HomePage/>} />
          <Route path="/Application" element={<ApplicationPage />} />
          {/* 🏠 Home Page Route */}
          <Route path="/" element={<HomePage />} />

          {/* 📄 Application Page Route */}
          <Route path="/application" element={<ApplicationPage />} />

          {/* 👥 Associate Page Route */}
          <Route path="/associate" element={<AssociatePage />} />

          {/*Success Page Route*/}
          <Route path="/success" element={<SuccessPage />} />

        </Routes>
      </Router>
    </Provider>
  );
}

export default App;
