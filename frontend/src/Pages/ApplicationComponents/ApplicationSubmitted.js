import React from "react";
import {
  Box,
  VStack,
  Text,
  Heading,
  Button,
} from "@chakra-ui/react";

const ApplicationSubmitted = () => {
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
        borderColor="green.300"
        borderRadius="md"
        boxShadow="lg"
        bg="green.50"
      >
        {/* Replace icon with emoji or text */}
        <Text fontSize="5xl">✅</Text>
        
        <Heading as="h1" size="xl" textAlign="center">
          Application Submitted Successfully!
        </Heading>
        
        <Text fontSize="lg" textAlign="center" mt={4}>
          Thank you for applying to Triton Consulting Group. We have received your application and will be reviewing it shortly.
        </Text>
        
        <Text fontSize="md" textAlign="center" mt={2}>
          You will receive an email confirmation with the next steps of our application process.
        </Text>

        <Text fontSize="sm" fontStyle="italic" mt={6}>
          Application ID: {Math.random().toString(36).substring(2, 10).toUpperCase()}
        </Text>
        
        <Button colorScheme="blue" size="md" mt={6} onClick={() => window.location.href = "/"}>
          Return to Home
        </Button>
      </VStack>
    </Box>
  );
};

export default ApplicationSubmitted;