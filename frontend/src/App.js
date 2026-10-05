import React from "react";
import { Provider } from "./components/ui/provider";
import Navbar from "./components/ui/Navbar";
import Footer from "./components/ui/Footer";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./Pages/Home/Homepage";
import ApplicationPage from "./Pages/ApplicationPage";
import AssociatePage from "./Pages/AssociatePage";
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
          <Route path="/application/:id" element={<ApplicationPage />} />

          {/* 👥 Associate Page Route */}
          <Route path="/associate" element={<AssociatePage />} />

          {/*Application Submitted Page Route*/}
          <Route path="/application-submitted" element={<ApplicationSubmitted />} />

          {/*Application View/Edit Page Route*/}
          <Route path="/application/view" element={<ApplicationViewEdit />} />

          {/*Admin Management Page Route*/}
          <Route path="/admin" element={<AdminManagementPage />} />

          {/*Admin Login Page Route*/}
          <Route path="/admin-login" element={<AdminLoginPage />} />

          {/* 404 Catch-all Route*/}
          <Route path="*" element={<h1>Page not found</h1>} />

        </Routes>
        <Footer />
      </Router>
    </Provider>
  );
}



export default App;

