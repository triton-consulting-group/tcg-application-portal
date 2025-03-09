import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

 // ✅ Import useNavigate for redirection
import axios from "axios";
import { 
  Box, 
  VStack, 
  Text, 
  Button, 
  Stack 
} from "@chakra-ui/react";

const ApplicationPage = () => {
  const navigate = useNavigate(); // ✅ Initialize useNavigate

  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    studentYear: "",
    major: "",
    appliedBefore: "",
    candidateType: "",
    resume: null, 
    transcript: null, 
    image: null,
    reason: "",
  });

  const handleFileChange = (e, fieldName) => {
    setFormData({ ...formData, [fieldName]: e.target.files[0] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formDataToSend = new FormData();

    Object.keys(formData).forEach((key) => {
      formDataToSend.append(key, formData[key]);
    });

    try {
      await axios.post("http://localhost:5002/api/applications", formDataToSend, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      navigate("/success"); // ✅ Redirect to Success Page
    } catch (error) {
      alert("❌ Error submitting application.");
      console.error(error);
    }
  };

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
          APPLICATION - TCG WINTER 25 RECRUITMENT
        </Text>

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <Stack>
            <Text fontWeight="bold" color="#222">Email *</Text>
            <input 
              type="email" 
              value={formData.email} 
              onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
              style={styles.input}
              required
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
            <Text fontWeight="bold" color="#222">Please submit your resume *</Text>
            <input type="file" onChange={(e) => handleFileChange(e, "resume")} style={styles.fileInput} required />
          </Stack>

          {/* Transcript Upload */}
          <Stack>
            <Text fontWeight="bold" color="#222">Please submit your transcript *</Text>
            <input type="file" onChange={(e) => handleFileChange(e, "transcript")} style={styles.fileInput} required />
          </Stack>

          {/* Profile Picture Upload */}
          <Stack>
            <Text fontWeight="bold" color="#222">Please upload a profile picture (JPG/PNG) *</Text>
            <input 
              type="file" 
              accept="image/png, image/jpeg"  
              onChange={(e) => handleFileChange(e, "image")} 
              style={styles.fileInput} 
              required 
            />
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
          <Button colorScheme="blue" size="lg" width="100%" mt={4} type="submit">
            Submit Application
          </Button>
        </form>
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

export default ApplicationPage;
