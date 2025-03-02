import React from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, VStack, Heading } from "@chakra-ui/react";

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <Box textAlign="center" p={10}>
      <Heading mb={6}>Welcome to the Portal</Heading>
      <VStack spacing={4}>
        <Button colorScheme="blue" size="lg" onClick={() => navigate("/application")}>
          Go to Application Page
        </Button>
        <Button colorScheme="green" size="lg" onClick={() => navigate("/associate")}>
          Go to Associate Page
        </Button>
      </VStack>
    </Box>
  );
};

export default HomePage;
