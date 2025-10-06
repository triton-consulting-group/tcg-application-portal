import React, { useState, useEffect } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { Flex, Box, Link, Button, Image } from "@chakra-ui/react";
import { auth, provider } from "../../Pages/Home/firebaseConfig";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import axios from "axios";
import API_BASE_URL from "../../config/api";
import TCGLogo from "../../assets/Images/TCGLogo.png";

const Navbar = () => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("applicant");
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // First, try to register the user (this will create them if they don't exist)
        try {
          await axios.post("${API_BASE_URL}/api/auth/register", {
            email: currentUser.email,
            name: currentUser.displayName || ""
          });
        } catch (error) {
          console.error("Error registering user:", error);
        }

        // Then get their role
        try {
          const response = await axios.get(`${API_BASE_URL}/api/auth/role/${currentUser.email}`);
          setRole(response.data.role || "applicant");
        } catch (error) {
          console.error("Error fetching user role:", error);
          setRole("applicant"); // Default to applicant if role fetch fails
        }
      } else {
        setRole("applicant");
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      setUser(result.user);

      // First, try to register the user (this will create them if they don't exist)
      try {
        await axios.post("${API_BASE_URL}/api/auth/register", {
          email: result.user.email,
          name: result.user.displayName || ""
        });
      } catch (error) {
        console.error("Error registering user:", error);
      }

      // Then get their role
      try {
        const response = await axios.get(`${API_BASE_URL}/api/auth/role/${result.user.email}`);
        setRole(response.data.role || "applicant");
      } catch (error) {
        console.error("Error fetching user role:", error);
        setRole("applicant"); // Default to applicant if role fetch fails
      }

      // Redirect user after login
      navigate("/");
    } catch (error) {
      console.error("Error signing in:", error.message);
      alert("Failed to sign in: " + error.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setRole("applicant");
      navigate("/"); // Redirect to home after logout
    } catch (error) {
      console.error("Error signing out:", error.message);
      alert("Failed to sign out: " + error.message);
    }
  };

  return (
    <Flex as="nav" align="center" justify="space-between" padding="1.5rem" bg="gray.100" color="#20354a">
      <Box>
        <Link as={RouterLink} to="/">
          <Image src={TCGLogo} alt="TCG Logo" height="40px" />
        </Link>
      </Box>
      <Box>
        {user && role === "associate" && (
          <Link as={RouterLink} to="/associate" marginRight="1.5rem" color="#20354a">
            Associate View
          </Link>
        )}
        {user && (
          <Link as={RouterLink} to="/application" marginRight="1.5rem" color="#20354a">
            Application
          </Link>
        )}
        {user ? (
          <Button onClick={handleSignOut} colorScheme="red">
            Logout
          </Button>
        ) : (
          <Button onClick={handleSignIn} colorScheme="blue">
            Login
          </Button>
        )}
      </Box>
    </Flex>
  );
};

export default Navbar;
