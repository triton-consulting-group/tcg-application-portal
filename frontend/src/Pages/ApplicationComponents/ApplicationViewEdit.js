import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { 
  Box, 
  VStack, 
  Text, 
  Button, 
  Stack,
  Alert,
  Spinner,
  Badge
} from "@chakra-ui/react";

const ApplicationViewEdit = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');
  
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (email) {
      fetchApplication();
    } else {
      setError("No email provided");
      setLoading(false);
    }
  }, [email]);

  const fetchApplication = async () => {
    try {
      const response = await axios.get(`http://localhost:5002/api/applications/email/${email}`);
      setApplication(response.data);
      setFormData({
        email: response.data.email,
        fullName: response.data.fullName,
        studentYear: response.data.studentYear,
        major: response.data.major,
        appliedBefore: response.data.appliedBefore,
        candidateType: response.data.candidateType,
        reason: response.data.reason,
        resume: null,
        transcript: null,
        image: null,
      });
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

  const handleFileChange = (e, fieldName) => {
    setFormData({ ...formData, [fieldName]: e.target.files[0] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const formDataToSend = new FormData();
    Object.keys(formData).forEach((key) => {
      if (formData[key] !== null) {
        formDataToSend.append(key, formData[key]);
      }
    });

    try {
      await axios.put(`http://localhost:5002/api/applications/email/${email}`, formDataToSend, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      
      // Refresh the application data
      await fetchApplication();
      setIsEditing(false);
      setSubmitting(false);
    } catch (error) {
      alert("❌ Error updating application.");
      console.error(error);
      setSubmitting(false);
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

  if (!isEditing) {
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
                  <Text color="blue.500" textDecoration="underline">
                    <a href={`http://localhost:5002${application.resume}`} target="_blank" rel="noopener noreferrer">
                      View Resume
                    </a>
                  </Text>
                </Box>
              )}

              {application.transcript && (
                <Box>
                  <Text fontWeight="bold" color="#222">Transcript:</Text>
                  <Text color="blue.500" textDecoration="underline">
                    <a href={`http://localhost:5002${application.transcript}`} target="_blank" rel="noopener noreferrer">
                      View Transcript
                    </a>
                  </Text>
                </Box>
              )}

              {application.image && (
                <Box>
                  <Text fontWeight="bold" color="#222">Profile Picture:</Text>
                  <Text color="blue.500" textDecoration="underline">
                    <a href={`http://localhost:5002${application.image}`} target="_blank" rel="noopener noreferrer">
                      View Image
                    </a>
                  </Text>
                </Box>
              )}
            </VStack>
          </Box>

          <Button 
            colorScheme="blue" 
            size="lg" 
            width="100%" 
            onClick={() => setIsEditing(true)}
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
  }

  // Edit mode
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
          EDIT APPLICATION - TCG WINTER 25 RECRUITMENT
        </Text>

        <form onSubmit={handleSubmit}>
          {/* Email (read-only) */}
          <Stack>
            <Text fontWeight="bold" color="#222">Email *</Text>
            <input 
              type="email" 
              value={formData.email} 
              disabled
              style={{...styles.input, backgroundColor: "#f5f5f5"}}
            />
          </Stack>

          {/* Full Name */}
          <Stack>
            <Text fontWeight="bold" color="#222">Full Name *</Text>
            <input 
              type="text" 
              value={formData.fullName} 
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} 
              style={styles.input}
              required
            />
          </Stack>

          {/* Student Year */}
          <Stack>
            <Text fontWeight="bold" color="#222">What year are you? *</Text>
            <select 
              value={formData.studentYear} 
              onChange={(e) => setFormData({ ...formData, studentYear: e.target.value })} 
              style={styles.input}
              required
            >
              <option value="">Select your year</option>
              <option value="1st">1st Year</option>
              <option value="2nd">2nd Year</option>
              <option value="3rd">3rd Year</option>
              <option value="4th">4th Year</option>
              <option value="5th+">5th Year or More</option>
            </select>
          </Stack>

          {/* Major */}
          <Stack>
            <Text fontWeight="bold" color="#222">What is your major? *</Text>
            <input 
              type="text" 
              value={formData.major} 
              onChange={(e) => setFormData({ ...formData, major: e.target.value })} 
              style={styles.input}
              required
            />
          </Stack>

          {/* Have You Applied Before? */}
          <Stack>
            <Text fontWeight="bold" color="#222">Have you applied to TCG before? *</Text>
            <select 
              value={formData.appliedBefore}  
              onChange={(e) => setFormData({ ...formData, appliedBefore: e.target.value })}  
              style={styles.input}
              required
            >
              <option value="">Select an option</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </Stack>

          {/* Tech or Non-Tech */}
          <Stack>
            <Text fontWeight="bold" color="#222">Are you Tech or Non-Tech? *</Text>
            <select 
              value={formData.candidateType}  
              onChange={(e) => setFormData({ ...formData, candidateType: e.target.value })}  
              style={styles.input}
              required
            >
              <option value="">Select an option</option>
              <option value="Tech">Tech</option>
              <option value="Non-Tech">Non-Tech</option>
            </select>
          </Stack>

          {/* Resume Upload */}
          <Stack>
            <Text fontWeight="bold" color="#222">Update Resume (optional)</Text>
            <input type="file" onChange={(e) => handleFileChange(e, "resume")} style={styles.fileInput} />
            {application.resume && (
              <Text fontSize="sm" color="gray.500">
                Current: <a href={`http://localhost:5002${application.resume}`} target="_blank" rel="noopener noreferrer">View Current Resume</a>
              </Text>
            )}
          </Stack>

          {/* Transcript Upload */}
          <Stack>
            <Text fontWeight="bold" color="#222">Update Transcript (optional)</Text>
            <input type="file" onChange={(e) => handleFileChange(e, "transcript")} style={styles.fileInput} />
            {application.transcript && (
              <Text fontSize="sm" color="gray.500">
                Current: <a href={`http://localhost:5002${application.transcript}`} target="_blank" rel="noopener noreferrer">View Current Transcript</a>
              </Text>
            )}
          </Stack>

          {/* Profile Picture Upload */}
          <Stack>
            <Text fontWeight="bold" color="#222">Update Profile Picture (optional)</Text>
            <input 
              type="file" 
              accept="image/png, image/jpeg"  
              onChange={(e) => handleFileChange(e, "image")} 
              style={styles.fileInput} 
            />
            {application.image && (
              <Text fontSize="sm" color="gray.500">
                Current: <a href={`http://localhost:5002${application.image}`} target="_blank" rel="noopener noreferrer">View Current Image</a>
              </Text>
            )}
          </Stack>

          {/* Why Join TCG? */}
          <Stack>
            <Text fontWeight="bold" color="#222">Why do you want to join TCG? *</Text>
            <textarea 
              value={formData.reason} 
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })} 
              style={styles.textarea}
              required
            />
          </Stack>

          {/* Submit Button */}
          <Button 
            colorScheme="blue" 
            size="lg" 
            width="100%" 
            mt={4} 
            type="submit"
            isLoading={submitting}
            loadingText="Updating..."
          >
            Update Application
          </Button>
        </form>

        <Button 
          colorScheme="gray" 
          size="md" 
          width="100%" 
          onClick={() => setIsEditing(false)}
        >
          Cancel Edit
        </Button>
      </VStack>
    </Box>
  );
};

// CSS Styles
const styles = {
  input: {
    width: "100%",
    padding: "12px",
    fontSize: "16px",
    borderRadius: "5px",
    border: "1px solid #ccc",
    backgroundColor: "#fff",
    color: "#222"
  },
  fileInput: {
    width: "100%",
    padding: "10px",
    fontSize: "16px",
    borderRadius: "5px",
    border: "1px solid #ccc",
    backgroundColor: "#fff",
    color: "#222"
  },
  textarea: {
    width: "100%",
    minHeight: "120px",
    padding: "12px",
    fontSize: "16px",
    borderRadius: "5px",
    border: "1px solid #ccc",
    backgroundColor: "#fff",
    color: "#222"
  }
};

export default ApplicationViewEdit; 