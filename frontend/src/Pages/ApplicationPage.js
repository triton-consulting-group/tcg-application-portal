import React, { useState, useEffect } from "react";
import ApplicationForm from "./ApplicationComponents/ApplicationForm";
import ApplicationSubmitted from "./ApplicationComponents/ApplicationSubmitted";
import ApplicationClosed from "./ApplicationComponents/ApplicationClosed";

const ApplicationPage = () => {
  // For quick testing, hardcode which view you want to see
  const testMode = "form"; // Change this to "form", "submitted", or "closed"
  
  let content;
  if (testMode === "form") {
    content = <ApplicationForm onSubmissionSuccess={() => {}} />;
  } else if (testMode === "submitted") {
    content = <ApplicationSubmitted />;
  } else if (testMode === "closed") {
    content = <ApplicationClosed />;
  }
  
  return (
    <div className="application-page-container">
      {content}
    </div>
  );
};

export default ApplicationPage;
