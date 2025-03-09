import React, { useState, useEffect } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { Flex, Box, Link, Button, Image } from "@chakra-ui/react";
import { auth, provider } from "../../Pages/Home/firebaseConfig";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import axios from "axios";
import TCGLogo from "../../assets/Images/TCGLogo.png";

const Navbar = () => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("applicant");
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          const response = await axios.get(`http://localhost:5002/api/auth/role/${currentUser.email}`);
          setRole(response.data.role);
        } catch (error) {
          console.error("Error fetching user role:", error);
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

      const response = await axios.get(`http://localhost:5002/api/auth/role/${result.user.email}`);
      setRole(response.data.role);

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
