import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"
import AuthButton from "./AuthButton";
import { getAuth, onAuthStateChanged } from "firebase/auth";
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
    const [currentUser, setCurrentUser] = useState(null);

    const navigate = useNavigate();
    const auth = getAuth();

    // Track authentication state changes
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
            navigate(`/application/view?email=${encodeURIComponent(user.email)}`);
        } else {
            navigate('/application');
        }
    }

    const handleCheckApplication = () => {
        if (currentUser && currentUser.email) {
            // User is logged in - redirect directly to their application 
            navigate(`/application/view?email=${encodeURIComponent(currentUser.email)}`);
        } else {
            // User is not logged in - require them to sign in first
            openModal();
        }
    }

    return (
        <Flex 
            width="100%" 
            height="100vh" 
            alignItems="center" 
            justifyContent="center"
            px={6}
            py={4}
            overflow="hidden"
            backgroundColor="#e2e8f0"
        >
            <Box textAlign="center" maxWidth="600px" w="100%">
                <Box display="flex" justifyContent="center" mb={6}>
                    <Image 
                        src={logo} 
                        alt="Triton Consulting Group Logo" 
                        maxWidth="200px" 
                        maxHeight="100px"
                    />
                </Box>
                
                <Heading mb={3} fontSize={{ base: "2xl", md: "3xl" }} color="gray.800">
                    Welcome to Triton Consulting Group
                </Heading>
                <Text fontSize={{ base: "lg", md: "xl" }} mb={8} color="gray.600" lineHeight="1.6">
                    Interested in joining? Apply now!
                </Text>
                
                <VStack spacing={20}>
                    <Button 
                        backgroundColor="#3182ce" 
                        color="white"
                        _hover={{ backgroundColor: "#2c5282" }}
                        border="none"
                        padding="18px 40px"
                        borderRadius="6px"
                        fontSize="18px"
                        fontWeight="500"
                        height="64px"
                        minWidth="220px"
                        onClick={() => {
                            if (currentUser && currentUser.email) {
                                // User is already signed in, go directly to application
                                navigate(`/application/view?email=${encodeURIComponent(currentUser.email)}`);
                            } else {
                                // User not signed in, open sign-in modal
                                openModal();
                            }
                        }}
                        boxShadow="0 4px 12px rgba(49, 130, 206, 0.3)"
                        _active={{ transform: "translateY(1px)" }}
                    >
                        Apply Now
                    </Button>
                    
                    <Button 
                        backgroundColor="#718096" 
                        color="white"
                        _hover={{ backgroundColor: "#5a6268" }}
                        border="none"
                        padding="10px 20px"
                        borderRadius="6px"
                        fontSize="14px"
                        fontWeight="500"
                        height="40px"
                        minWidth="140px"
                        onClick={() => navigate("/admin-login")}
                        boxShadow="0 2px 6px rgba(113, 128, 150, 0.2)"
                        _active={{ transform: "translateY(1px)" }}
                        mt="10px"
                    >
                        Admin Login
                    </Button>
                </VStack>

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