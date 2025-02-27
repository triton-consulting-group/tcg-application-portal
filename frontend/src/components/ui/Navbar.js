import React from "react";
import { Link as RouterLink } from "react-router-dom";
import { Flex, Box, Link } from "@chakra-ui/react";

const Navbar = () => {
  return (
    <Flex as="nav" align="center" justify="space-between" padding="1.5rem" bg="teal.500" color="white">
      <Box>
        <Link as={RouterLink} to="/">
          Home
        </Link>
      </Box>
      <Box>
        <Link as={RouterLink} to="/application" marginRight="1.5rem">
          Application
        </Link>
      </Box>
    </Flex>
  );
};

export default Navbar;