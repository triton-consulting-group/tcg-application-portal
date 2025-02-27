import React, { useState } from "react";
import { Radio, RadioGroup } from "../components/ui/radio";
import { useNavigate } from "react-router-dom"; // ✅ Import useNavigate for redirection
import axios from "axios";
import { 
  Box, 
  VStack, 
  Text, 
  Button, 
  Stack 
} from "@chakra-ui/react";

const ApplicationPage = () => {
  const [appliedBefore, setAppliedBefore] = useState("");
  const [candidateType, setCandidateType] = useState("");
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

        {/* Upload Photo */}
        <Box>
          <Text fontWeight="bold" mb={1}>
            Upload A Photo of Yourself
          </Text>
          <Input
            pt="5px"
            pl="10px"
            type="file"
            border="2px solid"
            borderColor="gray.400"
          />
        </Box>

        {/* Graduation Year */}
        <Box>
          <Text fontWeight="bold" mb={1}>
            Graduation Year
          </Text>
          <Input
            type="number"
            pl="10px"
            onBlur={handleYearChange}
            placeholder="YYYY"
            border="2px solid"
            borderColor="gray.400"
            borderRadius="md"
            _focus={{ borderColor: "blue.500" }}
          />
        </Box>

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

        {/* Minor(s) */}
        <Box>
          <Text fontWeight="bold" mb={1}>
            Minor(s)
          </Text>
          <Input
            placeholder="Enter your minor(s)"
            pl="10px"
            border="2px solid"
            borderColor="gray.400"
            borderRadius="md"
            _focus={{ borderColor: "blue.500" }}
          />
        </Box>

        {/* Have you applied to TCG before? */}
        <Box>
          <Text fontWeight="bold" mb={1}>
            Have you applied to TCG before?
          </Text>
          <RadioGroup onChange={setAppliedBefore} value={appliedBefore}>
            <Stack direction="row">
              <Radio value="yes">Yes</Radio>
              <Radio value="no">No</Radio>
            </Stack>
          </RadioGroup>
        </Box>

        {/* Are you applying as a tech candidate or non-tech candidate? */}
        <Box>
          <Text fontWeight="bold" mb={1}>
          Are you applying as a tech candidate or non-tech candidate?
          </Text>
          <RadioGroup onChange={setAppliedBefore} value={appliedBefore}>
            <Stack direction="row">
              <Radio value="Tech">Yes</Radio>
              <Radio value="Non-Tech">No</Radio>
            </Stack>
          </RadioGroup>
        </Box>
        
        {/* Why do you want to join TCG? */}
        <Box>
          <Text fontWeight="bold">Why do you want to join TCG?</Text>
          <Textarea
            placeholder="Explain your interest in TCG..."
            value={tcgReason}
            onChange={handleTcgReasonChange}
            minH="150px"
            pl={3}
            border="2px solid"
            borderColor="gray.400"
            borderRadius="md"
            _focus={{ borderColor: "blue.500" }}
          />
          <Text
            fontSize="sm"
            color={
              tcgReason.split(/\s+/).filter((word) => word !== "").length >=
              wordLimit
                ? "red.500"
                : "gray.500"
            }
          >
            {tcgReason.split(/\s+/).filter((word) => word !== "").length} /{" "}
            {wordLimit} words
          </Text>
        </Box>

        {/* Upload Transcript */}
        <Box>
          <Text fontWeight="bold" mb={1}>
            Upload Transcript
          </Text>
          <Input
            pt="5px"
            pl="10px"
            type="file"
            border="2px solid"
            borderColor="gray.400"
          />
        </Box>

        {/* Upload Resume */}
        <Box>
          <Text fontWeight="bold" mb={1}>
            Upload Resume
          </Text>
          <Input
            pt="5px"
            pl="10px"
            type="file"
            border="2px solid"
            borderColor="gray.400"
          />
        </Box>
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
