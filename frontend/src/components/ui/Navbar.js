import React from "react";
import { Link as RouterLink } from "react-router-dom";
import { Flex, Box, Link, Image } from "@chakra-ui/react";
import TCGLogo from "../../assets/Images/TCGLogo.png"; // Adjust the path to your logo

const Navbar = () => {
  return (
    <Flex as="nav" align="center" justify="space-between" padding="1.5rem" bg="gray.100" color="#20354a">
      <Box>
        <Link as={RouterLink} to="/">
          <Image src={TCGLogo} alt="TCG Logo" height="40px" />
        </Link>
      </Box>
      <Box>
        <Link as={RouterLink} to="/application" marginRight="1.5rem" color="#20354a">
          Application
        </Link>
      </Box>
    </Flex>
  );
};

export default Navbar;