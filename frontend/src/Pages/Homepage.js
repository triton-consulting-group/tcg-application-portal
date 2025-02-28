import React from "react";
import { Box, Heading, Text, Button } from "@chakra-ui/react";

const Homepage = () => {
  return (
    <Box textAlign="center" py={10} px={6}>
      <Heading as="h1" size="xl" mb={4}>
        Welcome to TCG Application Portal
      </Heading>
      <Text fontSize="lg" mb={4}>
        This is the homepage. Navigate to the application page to apply.
      </Text>
      <Button colorScheme="teal" size="md">
        Learn More
      </Button>
    </Box>
  );
};

export default Homepage;