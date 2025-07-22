import React from "react";
import { Provider } from "./components/ui/provider";
import Navbar from "./components/ui/Navbar";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./Pages/Home/Homepage";
import ApplicationPage from "./Pages/ApplicationPage";
import AssociatePage from "./Pages/AssociatePage";
import SuccessPage from "./Pages/SuccessPage";
import ApplicationSubmitted from "./Pages/ApplicationComponents/ApplicationSubmitted";
import ApplicationViewEdit from "./Pages/ApplicationComponents/ApplicationViewEdit";
import AdminManagementPage from "./Pages/AdminManagementPage";
import AdminLoginPage from "./Pages/AdminLoginPage";

const App = () => {
  return (
    <Provider> 
      <Router>
      <Navbar /> 
        <Routes>
          {/* 🏠 Home Page Route */}
          <Route path="/" element={<HomePage />} />

          {/* 📄 Application Page Route */}
          <Route path="/application" element={<ApplicationPage />} />

          {/* 👥 Associate Page Route */}
          <Route path="/associate" element={<AssociatePage />} />

          {/*Success Page Route*/}
          <Route path="/success" element={<SuccessPage />} />

          {/*Application Submitted Page Route*/}
          <Route path="/ApplicationComponents/ApplicationSubmitted" element={<ApplicationSubmitted />} />

          {/*Application View/Edit Page Route*/}
          <Route path="/application/view" element={<ApplicationViewEdit />} />

          {/*Admin Management Page Route*/}
          <Route path="/admin" element={<AdminManagementPage />} />

          {/*Admin Login Page Route*/}
          <Route path="/admin-login" element={<AdminLoginPage />} />

        </Routes>
      </Router>
    </Provider>
  );
}



export default App;

