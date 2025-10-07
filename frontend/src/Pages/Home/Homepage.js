import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"
import AuthButton from "./AuthButton";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebaseConfig";

import Modal from "./Modal";
import { 
    Box, 
    Button, 
    VStack, 
    Heading, 
    Text, 
    Flex, 
    Image,
    Input,
    Alert
} from "@chakra-ui/react";
import logo from "../../assets/Images/TCGLogo.png"; // ✅ Corrected path


function HomePage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [checkEmail, setCheckEmail] = useState("");
    const [showCheckForm, setShowCheckForm] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    const navigate = useNavigate();

    // Track authentication state
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
        });
        return () => unsubscribe();
    }, [auth]);

    const openModal = () => {
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
    };

    const handleSuccessfulSignIn = () => {
        closeModal();
        const user = auth.currentUser;
        if (user && user.email) {
            navigate(`/application?email=${encodeURIComponent(user.email)}`);
        } else {
            navigate('/application');
        }
    }

    const handleCheckApplication = () => {
        if (currentUser && currentUser.email) {
            // User is logged in - redirect directly to their application without email in URL
            navigate('/application');
        } else if (checkEmail.trim()) {
            // User is not logged in - use manual email entry
            navigate(`/application?email=${encodeURIComponent(checkEmail.trim())}`);
        }
    }

    return (
        <Flex 
            width="100%" 
            height="100vh" 
            alignItems="center" 
            justifyContent="center"
        >
            <Box textAlign="center" p={12} maxWidth="800px">
                <Box display="flex" justifyContent="center" mb={6}>
                    <Image 
                        src={logo} 
                        alt="Triton Consulting Group Logo" 
                        maxWidth="200px" 
                        maxHeight="100px"
                    />
                </Box>
                
                <Heading mb={3}>Welcome to Triton Consulting Group</Heading>
                <Text fontSize="xl" mb={6} color="gray.600">Interested in joining? Apply now!</Text>
                <VStack spacing={4}>
                    <Button 
                        backgroundColor="#003366" 
                        color="white"
                        _hover={{ backgroundColor: "#004080" }}
                        size="xl" 
                        onClick={openModal}
                        height="60px"
                        fontSize="xl"
                        px={10}
                    >
                        Apply Now
                    </Button>
                    
                    <Button 
                        backgroundColor="#28a745" 
                        color="white"
                        _hover={{ backgroundColor: "#218838" }}
                        size="lg" 
                        onClick={currentUser ? handleCheckApplication : () => setShowCheckForm(!showCheckForm)}
                        height="50px"
                        fontSize="lg"
                        px={8}
                    >
                        {currentUser ? "View My Application" : "Check My Application"}
                    </Button>
                    
                    <Button 
                        backgroundColor="#6c757d" 
                        color="white"
                        _hover={{ backgroundColor: "#5a6268" }}
                        size="md" 
                        onClick={() => navigate("/admin-login")}
                        height="40px"
                        fontSize="md"
                        px={6}
                    >
                        Admin Login
                    </Button>
                </VStack>

                {showCheckForm && (
                    <Box mt={6} p={4} border="1px solid" borderColor="gray.200" borderRadius="md" bg="white">
                        <Text mb={3} fontWeight="bold">Enter your email to check your application:</Text>
                        <VStack spacing={3}>
                            <Input
                                type="email"
                                placeholder="Enter your email address"
                                value={checkEmail}
                                onChange={(e) => setCheckEmail(e.target.value)}
                                size="lg"
                            />
                            <Button 
                                colorScheme="blue" 
                                onClick={handleCheckApplication}
                                isDisabled={!checkEmail.trim()}
                                width="100%"
                            >
                                Check Application
                            </Button>
                        </VStack>
                    </Box>
                )}
                <Modal isOpen={isModalOpen} onClose={closeModal}>
                    <div className="modal-content">
                        <h2>Sign in to Continue</h2>
                        <p>Please sign in with your Google account to continue with your application.</p>
                        <div className="modal-auth-button">
                            <AuthButton onSuccessfulSignIn={handleSuccessfulSignIn} />
                        </div>
                    </div>
                </Modal>
            </Box>
        </Flex>
    );
}

export default HomePage;