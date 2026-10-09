import React, { useState, useEffect } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { Flex, Box, Link, Button, Image } from "@chakra-ui/react";
import { auth, provider, getSignInErrorMessage } from "../../Pages/Home/firebaseConfig";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import axios from "axios";
import API_BASE_URL from "../../config/api";
import TCGLogo from "../../assets/Images/TCGLogo.png";

// Registers the signed-in user and returns their role. Both calls carry the Firebase ID token;
// the backend takes the email from the token, so users can only register or look up themselves.
const registerAndFetchRole = async (firebaseUser) => {
  const headers = { Authorization: `Bearer ${await firebaseUser.getIdToken()}` };

  // First, try to register the user (this will create them if they don't exist)
  try {
    await axios.post(`${API_BASE_URL}/api/auth/register`, {
      name: firebaseUser.displayName || ""
    }, { headers });
  } catch (error) {
    console.error("Error registering user:", error);
  }

  // Then get their role
  try {
    const response = await axios.get(`${API_BASE_URL}/api/auth/role/${encodeURIComponent(firebaseUser.email)}`, { headers });
    return response.data.role || "applicant";
  } catch (error) {
    console.error("Error fetching user role:", error);
    return "applicant"; // Default to applicant if role fetch fails
  }
};

const Navbar = () => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("applicant");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        setRole(await registerAndFetchRole(currentUser));
      } else {
        setRole("applicant");
      }
    });

    return () => unsubscribe();
  }, []);

  const handleViewApplication = async () => {
    if (user) {
      // User is logged in, navigate directly to their application
      navigate(`/application/view?email=${encodeURIComponent(user.email)}`);
    } else {
      // User is not logged in, sign them in first
      if (isSigningIn) return; // Prevent multiple popup requests
      
      setIsSigningIn(true);
      try {
        const result = await signInWithPopup(auth, provider);
        
        setRole(await registerAndFetchRole(result.user));

        // After successful login, navigate to their application
        navigate(`/application/view?email=${encodeURIComponent(result.user.email)}`);
      } catch (error) {
        console.error("Error signing in:", error.message);
        // Handle cancelled popup more gracefully
        if (error.code !== "auth/cancelled-popup-request") {
          alert(getSignInErrorMessage(error));
        }
      } finally {
        setIsSigningIn(false);
      }
    }
  };

  const handleSignIn = async () => {
    if (isSigningIn) return; // Prevent multiple popup requests
    
    setIsSigningIn(true);
    try {
      const result = await signInWithPopup(auth, provider);
      setUser(result.user);

      setRole(await registerAndFetchRole(result.user));

      // Redirect user after login
      navigate("/");
    } catch (error) {
      console.error("Error signing in:", error.message);
      // Handle cancelled popup more gracefully
      if (error.code !== "auth/cancelled-popup-request") {
        alert(getSignInErrorMessage(error));
      }
    } finally {
      setIsSigningIn(false);
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
        <Button 
          onClick={handleViewApplication}
          marginRight="1rem"
          backgroundColor="#3182ce"
          color="white"
          _hover={{ backgroundColor: "#2c5282" }}
          border="none"
          padding="12px 24px"
          borderRadius="6px"
          fontSize="16px"
          textDecoration="none"
          isLoading={isSigningIn && !user}
          loadingText="Signing in..."
          disabled={isSigningIn && !user}
        >
          View My Application
        </Button>
        {user ? (
          <Button 
            onClick={handleSignOut} 
            backgroundColor="#718096"
            color="white"
            _hover={{ backgroundColor: "#5a6268" }}
            border="none"
            padding="12px 24px"
            borderRadius="6px"
            fontSize="16px"
          >
            Logout
          </Button>
        ) : (
          <Button 
            onClick={handleSignIn} 
            backgroundColor="#3182ce"
            color="white"
            _hover={{ backgroundColor: "#2c5282" }}
            border="none"
            padding="12px 24px"
            borderRadius="6px"
            fontSize="16px"
            isLoading={isSigningIn}
            loadingText="Signing in..."
            disabled={isSigningIn}
          >
            Sign in
          </Button>
        )}
      </Box>
    </Flex>
  );
};

export default Navbar;
