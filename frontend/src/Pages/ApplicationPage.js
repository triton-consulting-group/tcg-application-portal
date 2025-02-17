import React from "react";
import {
  Flex,
  VStack,
  Input,
  Textarea,
  Button,
  Box,
  Text,
} from "@chakra-ui/react";

const currentYear = new Date().getFullYear();
const gradYears = Array.from({ length: 5 }, (_, i) => currentYear + i);
const minYear = currentYear;
const maxYear = currentYear + 4;
const handleYearChange = (e) => {
  let value = parseInt(e.target.value);
  if (value < currentYear || value > currentYear + 5) {
    alert("Please enter a valid graduation year!");
    e.target.value = "";
  }
};

const ApplicationPage = () => {
  return (
    <VStack spacing={4} align="stretch" maxW="500px" mx="auto" mt={10}>
      {/* First Name */}
      <Box>
        <Text fontWeight="bold">First Name</Text>
        <Input placeholder="Enter your first name" />
      </Box>

      {/* Last Name */}
      <Box>
        <Text fontWeight="bold">Last Name</Text>
        <Input placeholder="Enter your last name" />
      </Box>

      {/* Graduation Year */}
      <Box>
        <Text fontWeight="bold">Graduation Year</Text>
        <Input type="number" onBlur={handleYearChange} placeholder="YYYY" />
      </Box>

      {/* Major */}
      <Box>
        <Text fontWeight="bold">Major</Text>
        <Input placeholder="Enter your major" />
      </Box>

      {/* Why do you want to join TCG? */}
      <Box>
        <Text fontWeight="bold">Why do you want to join TCG?</Text>
        <Textarea placeholder="Explain your interest in TCG..." />
      </Box>

      {/* Upload Resume */}
      <Box>
        <Text fontWeight="bold">Upload Resume</Text>
        <Input type="file" />
      </Box>

      {/* Submit Button */}
      <Button colorScheme="blue" size="lg">
        Submit Application
      </Button>
    </VStack>
  );
};

export default ApplicationPage;
