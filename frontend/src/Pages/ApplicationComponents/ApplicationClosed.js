import React from "react";
import {
  Box,
  VStack,
  Text,
  Heading,
  Button,
} from "@chakra-ui/react";

const ApplicationClosed = () => {
  return (
    <Box bg="white" color="black" minH="100vh" p={6}>
      <VStack
        spacing={5}
        align="center"
        maxW="700px"
        mx="auto"
        mt={10}
        p={8}
        border="2px solid"
        borderColor="blue.300"
        borderRadius="md"
        boxShadow="lg"
        bg="blue.50"
      >
        {/* Replace icon with emoji or text */}
        <Text fontSize="5xl">ℹ️</Text>
        
        <Heading as="h1" size="xl" textAlign="center">
          Applications Currently Closed
        </Heading>
        
        <Text fontSize="lg" textAlign="center" mt={4}>
          Thank you for your interest in Triton Consulting Group. Our application period is currently closed.
        </Text>
        
        <Text fontSize="md" textAlign="center" mt={2}>
          We typically accept applications at the beginning of each quarter. Please check back later or follow our social media channels for announcements about our next recruitment cycle.
        </Text>

        <Button colorScheme="blue" size="md" mt={6} onClick={() => window.location.href = "/"}>
          Return to Home
        </Button>
      </VStack>
    </Box>
  );
};

export default ApplicationClosed;