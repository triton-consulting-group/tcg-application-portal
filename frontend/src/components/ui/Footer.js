import React from "react";
import { Link as RouterLink } from "react-router-dom";
import { Flex, Link } from "@chakra-ui/react";

const Footer = () => {
  return (
    <Flex
      as="footer"
      align="center"
      justify="center"
      padding="1rem 1.5rem"
      bg="gray.100"
      fontSize="sm"
    >
      <Link asChild color="gray.600" _hover={{ color: "#20354a" }}>
        <RouterLink to="/admin-login">Admin Login</RouterLink>
      </Link>
    </Flex>
  );
};

export default Footer;
