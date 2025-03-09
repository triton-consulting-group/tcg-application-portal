import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Text, Button } from "@chakra-ui/react";

const SuccessPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to ApplicationSubmitted after 2 seconds
    const timer = setTimeout(() => {
      navigate("/ApplicationComponents/ApplicationSubmitted");
    }, 2000); // 2-second delay

    return () => clearTimeout(timer); // Cleanup timer on unmount
  }, [navigate]);

  return (
    <Box textAlign="center" p={6} mt={10}>
      <Text fontSize="2xl" fontWeight="bold" color="green.500">
        ✅ Your application has been submitted successfully!
      </Text>
      <Text mt={4}>
        We have received your application. Our team will review it and get back to you soon.
      </Text>
      <Text mt={2} fontSize="sm" color="gray.500">
        Redirecting to confirmation page...
      </Text>
      <Button onClick={() => navigate("./frontend/src/Pages/ApplicationComponents/ApplicationSubmitted")} mt={6} colorScheme="blue">
        Go to Application Submitted
      </Button>
    </Box>
  );
};

export default SuccessPage;
