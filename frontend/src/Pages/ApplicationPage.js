import React, { useState, useEffect } from "react";
import ApplicationForm from "./ApplicationComponents/ApplicationForm";
import ApplicationSubmitted from "./ApplicationComponents/ApplicationSubmitted";
import ApplicationClosed from "./ApplicationComponents/ApplicationClosed";

const ApplicationPage = () => {
  // For quick testing, hardcode which view you want to see
  const testMode = "form"; // Change this to "form", "submitted", or "closed"
  
  let content;
  if (testMode === "form") {
    content = <ApplicationForm onSubmissionSuccess={() => {}} />;
  } else if (testMode === "submitted") {
    content = <ApplicationSubmitted />;
  } else if (testMode === "closed") {
    content = <ApplicationClosed />;
  }
  
  return (
    <div className="application-page-container">
      {content}
    </div>
  );
};

export default ApplicationPage;

// import React, { useState } from "react";
// import { Radio, RadioGroup } from "../components/ui/radio";
// import {
//   Flex,
//   VStack,
//   Input,
//   Textarea,
//   Button,
//   Box,
//   Text,
//   Stack,
// } from "@chakra-ui/react";

// const currentYear = new Date().getFullYear();
// const handleYearChange = (e) => {
//   let value = parseInt(e.target.value);
//   if (value < currentYear || value > currentYear + 5) {
//     alert("Please enter a valid graduation year!");
//     e.target.value = "";
//   }
// };

// const ApplicationPage = () => {
//   const [appliedBefore, setAppliedBefore] = useState("");
//   const [candidateType, setCandidateType] = useState("");
//   const [tcgReason, setTcgReason] = useState("");
//   const wordLimit = 250; // Set word limit

//   const handleTcgReasonChange = (e) => {
//     const words = e.target.value.split(/\s+/).filter((word) => word !== ""); // Count words
//     if (words.length <= wordLimit) {
//       setTcgReason(e.target.value);
//     }
//   };

//   return (
//     <Box bg="white" color="black" minH="100vh" p={6}>
//       <VStack
//         spacing={5}
//         align="stretch"
//         maxW="700px"
//         mx="auto"
//         mt={10}
//         p={6}
//         border="2px solid"
//         borderColor="gray.300"
//         borderRadius="md"
//         boxShadow="lg"
//         bg="gray.50"
//       >
//         {/* First Name */}
//         <Box>
//           <Text fontWeight="bold" mb={1}>
//             First Name
//           </Text>
//           <Input
//             pl="10px"
//             placeholder="Enter your first name"
//             border="2px solid"
//             borderColor="gray.400"
//             borderRadius="md"
//             _focus={{ borderColor: "blue.500" }}
//           />
//         </Box>

//         {/* Last Name */}
//         <Box>
//           <Text fontWeight="bold" mb={1}>
//             Last Name
//           </Text>
//           <Input
//             pl="10px"
//             placeholder="Enter your last name"
//             border="2px solid"
//             borderColor="gray.400"
//             borderRadius="md"
//             _focus={{ borderColor: "blue.500" }}
//           />
//         </Box>

//         {/* Upload Photo */}
//         <Box>
//           <Text fontWeight="bold" mb={1}>
//             Upload A Photo of Yourself
//           </Text>
//           <Input
//             pt="5px"
//             pl="10px"
//             type="file"
//             border="2px solid"
//             borderColor="gray.400"
//           />
//         </Box>

//         {/* Graduation Year */}
//         <Box>
//           <Text fontWeight="bold" mb={1}>
//             Graduation Year
//           </Text>
//           <Input
//             type="number"
//             pl="10px"
//             onBlur={handleYearChange}
//             placeholder="YYYY"
//             border="2px solid"
//             borderColor="gray.400"
//             borderRadius="md"
//             _focus={{ borderColor: "blue.500" }}
//           />
//         </Box>

//         {/* Major */}
//         <Box>
//           <Text fontWeight="bold" mb={1}>
//             Major
//           </Text>
//           <Input
//             placeholder="Enter your major"
//             pl="10px"
//             border="2px solid"
//             borderColor="gray.400"
//             borderRadius="md"
//             _focus={{ borderColor: "blue.500" }}
//           />
//         </Box>

//         {/* Minor(s) */}
//         <Box>
//           <Text fontWeight="bold" mb={1}>
//             Minor(s)
//           </Text>
//           <Input
//             placeholder="Enter your minor(s)"
//             pl="10px"
//             border="2px solid"
//             borderColor="gray.400"
//             borderRadius="md"
//             _focus={{ borderColor: "blue.500" }}
//           />
//         </Box>

//         {/* Have you applied to TCG before? */}
//         <Box>
//           <Text fontWeight="bold" mb={1}>
//             Have you applied to TCG before?
//           </Text>
//           <RadioGroup onChange={setAppliedBefore} value={appliedBefore}>
//             <Stack direction="row">
//               <Radio value="yes">Yes</Radio>
//               <Radio value="no">No</Radio>
//             </Stack>
//           </RadioGroup>
//         </Box>

//         {/* Are you applying as a tech candidate or non-tech candidate? */}
//         <Box>
//           <Text fontWeight="bold" mb={1}>
//           Are you applying as a tech candidate or non-tech candidate?
//           </Text>
//           <RadioGroup onChange={setAppliedBefore} value={appliedBefore}>
//             <Stack direction="row">
//               <Radio value="Tech">Yes</Radio>
//               <Radio value="Non-Tech">No</Radio>
//             </Stack>
//           </RadioGroup>
//         </Box>
        
//         {/* Why do you want to join TCG? */}
//         <Box>
//           <Text fontWeight="bold">Why do you want to join TCG?</Text>
//           <Textarea
//             placeholder="Explain your interest in TCG..."
//             value={tcgReason}
//             onChange={handleTcgReasonChange}
//             minH="150px"
//             pl={3}
//             border="2px solid"
//             borderColor="gray.400"
//             borderRadius="md"
//             _focus={{ borderColor: "blue.500" }}
//           />
//           <Text
//             fontSize="sm"
//             color={
//               tcgReason.split(/\s+/).filter((word) => word !== "").length >=
//               wordLimit
//                 ? "red.500"
//                 : "gray.500"
//             }
//           >
//             {tcgReason.split(/\s+/).filter((word) => word !== "").length} /{" "}
//             {wordLimit} words
//           </Text>
//         </Box>

//         {/* Upload Transcript */}
//         <Box>
//           <Text fontWeight="bold" mb={1}>
//             Upload Transcript
//           </Text>
//           <Input
//             pt="5px"
//             pl="10px"
//             type="file"
//             border="2px solid"
//             borderColor="gray.400"
//           />
//         </Box>

//         {/* Upload Resume */}
//         <Box>
//           <Text fontWeight="bold" mb={1}>
//             Upload Resume
//           </Text>
//           <Input
//             pt="5px"
//             pl="10px"
//             type="file"
//             border="2px solid"
//             borderColor="gray.400"
//           />
//         </Box>

//         {/* Submit Button */}
//         <Button colorScheme="blue" size="lg" w="full">
//           Submit Application
//         </Button>
//       </VStack>
//     </Box>
//   );
// };

// export default ApplicationPage;
