import React from "react";
import { Link } from "react-router-dom";
import { Box, Text, Button } from "@chakra-ui/react";

const SuccessPage = () => {
  return (
    <Box textAlign="center" p={6} mt={10}>
      <Text fontSize="2xl" fontWeight="bold" color="green.500">
        ✅ Your application has been submitted successfully!
      </Text>
      <Text mt={4}>
        We have received your application. Our team will review it and get back to you soon.
      </Text>
      <Button as={Link} to="/" mt={6} colorScheme="blue">
        Go Back to Home
      </Button>
    </Box>
  );
};

export default SuccessPage;
