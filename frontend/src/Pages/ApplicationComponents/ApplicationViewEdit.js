import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import axios from "axios";
import API_BASE_URL from "../../config/api";
import { 
  Box, 
  VStack, 
  Text, 
  Button, 
  Alert,
  Spinner,
  Badge
} from "@chakra-ui/react";

// Helper function to get signed URL for file access
const getFileUrl = async (filePath) => {
  if (!filePath) return "";
  
  try {
    const response = await axios.get(`${API_BASE_URL}/api/applications/file-url/${encodeURIComponent(filePath)}`);
    return response.data.url;
  } catch (error) {
    console.error("Error getting file URL:", error);
    return filePath; // Fallback to original path
  }
};

const ApplicationViewEdit = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id } = useParams(); // ✅ Get ID from URL params
  const email = searchParams.get('email');
  const [currentUser, setCurrentUser] = useState(null);
  const auth = getAuth();
  
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Track authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    if (id) {
      // If we have an ID, fetch application by ID
      fetchApplicationById(id);
    } else {
      // Otherwise, use email-based lookup
      const emailToUse = email || (currentUser && currentUser.email);
      if (emailToUse) {
        fetchApplication(emailToUse);
      } else {
        setError("No email or ID provided");
        setLoading(false);
      }
    }
  }, [id, email, currentUser]);

  const fetchApplicationById = async (applicationId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/applications/${applicationId}`);
      setApplication(response.data);
      setLoading(false);
    } catch (error) {
      if (error.response?.status === 404) {
        setError("No application found for this ID. You can create a new application.");
      } else {
        setError("Failed to load application");
      }
      setLoading(false);
    }
  };

  const fetchApplication = async (emailToUse) => {
    try {
      const emailParam = emailToUse || email;
      const response = await axios.get(`${API_BASE_URL}/api/applications/email/${emailParam}`);
      setApplication(response.data);
      setLoading(false);
    } catch (error) {
      if (error.response?.status === 404) {
        setError("No application found for this email. You can create a new application.");
      } else {
        setError("Failed to load application");
      }
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box textAlign="center" p={6} mt={10}>
        <Spinner size="xl" />
        <Text mt={4}>Loading your application...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box textAlign="center" p={6} mt={10}>
              <Alert status="error" mb={4}>
        ❌ {error}
      </Alert>
        <Button colorScheme="blue" onClick={() => navigate("/application")}>
          Create New Application
        </Button>
      </Box>
    );
  }

  // View mode
  return (
      <Box bg="gray.200" minH="100vh" p={6}>
        <VStack
          spacing={5}
          align="stretch"
          maxW="600px"
          mx="auto"
          mt={10}
          p={6}
          borderRadius="md"
          boxShadow="lg"
          bg="white"
        >
          <Text fontSize="2xl" fontWeight="bold" textAlign="center" color="black">
            YOUR APPLICATION - TCG WINTER 25 RECRUITMENT
          </Text>

          <Box p={4} border="1px solid" borderColor="gray.200" borderRadius="md">
            <VStack spacing={4} align="stretch">
              <Box>
                <Text fontWeight="bold" color="#222">Status:</Text>
                <Badge 
                  colorScheme={
                    application.status === "Accepted" ? "green" : 
                    application.status === "Rejected" ? "red" : 
                    application.status === "Maybe" ? "yellow" : "blue"
                  }
                  fontSize="md"
                  p={2}
                >
                  {application.status}
                </Badge>
              </Box>

              <Box>
                <Text fontWeight="bold" color="#222">Email:</Text>
                <Text>{application.email}</Text>
              </Box>

              <Box>
                <Text fontWeight="bold" color="#222">Full Name:</Text>
                <Text>{application.fullName}</Text>
              </Box>

              <Box>
                <Text fontWeight="bold" color="#222">Student Year:</Text>
                <Text>{application.studentYear}</Text>
              </Box>

              <Box>
                <Text fontWeight="bold" color="#222">Major:</Text>
                <Text>{application.major}</Text>
              </Box>

              <Box>
                <Text fontWeight="bold" color="#222">Applied Before:</Text>
                <Text>{application.appliedBefore}</Text>
              </Box>

              <Box>
                <Text fontWeight="bold" color="#222">Candidate Type:</Text>
                <Text>{application.candidateType}</Text>
              </Box>

              <Box>
                <Text fontWeight="bold" color="#222">Why do you want to join TCG?</Text>
                <Text>{application.reason}</Text>
              </Box>

              {application.resume && (
                <Box>
                  <Text fontWeight="bold" color="#222">Resume:</Text>
                  <Button 
                    colorScheme="blue" 
                    variant="link" 
                    onClick={async () => {
                      const url = await getFileUrl(application.resume);
                      if (url) window.open(url, '_blank');
                    }}
                  >
                    View Resume
                  </Button>
                </Box>
              )}

              {application.transcript && (
                <Box>
                  <Text fontWeight="bold" color="#222">Transcript:</Text>
                  <Button 
                    colorScheme="blue" 
                    variant="link" 
                    onClick={async () => {
                      const url = await getFileUrl(application.transcript);
                      if (url) window.open(url, '_blank');
                    }}
                  >
                    View Transcript
                  </Button>
                </Box>
              )}

              {application.image && (
                <Box>
                  <Text fontWeight="bold" color="#222">Profile Picture:</Text>
                  <Button 
                    colorScheme="blue" 
                    variant="link" 
                    onClick={async () => {
                      const url = await getFileUrl(application.image);
                      if (url) window.open(url, '_blank');
                    }}
                  >
                    View Image
                  </Button>
                </Box>
              )}
            </VStack>
          </Box>

          <Button 
            colorScheme="blue" 
            size="lg" 
            width="100%" 
            onClick={() => navigate("/application")}
            isDisabled={application.status === "Accepted" || application.status === "Rejected" || application.status === "Final Interview - Yes"}
          >
            Edit Application
          </Button>

          <Button 
            colorScheme="gray" 
            size="md" 
            width="100%" 
            onClick={() => navigate("/")}
          >
            Return to Home
          </Button>
        </VStack>
      </Box>
    );
};


export default ApplicationViewEdit; 