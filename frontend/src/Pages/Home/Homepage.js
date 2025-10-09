import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"
import AuthButton from "./AuthButton";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebaseConfig";
import Modal from "./Modal";
import axios from "axios";
import { 
    Box, 
    Button, 
    VStack, 
    Heading, 
    Text, 
    Flex, 
    Image,
} from "@chakra-ui/react";
import logo from "../../assets/Images/TCGLogo.png";
import API_BASE_URL from "../../config/api";

function HomePage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [shouldNavigateAfterLogin, setShouldNavigateAfterLogin] = useState(false);

    const navigate = useNavigate();

    // Track authentication state
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            console.log("Auth state changed:", user ? user.email : "No user");
            setCurrentUser(user);
            
            if (user && shouldNavigateAfterLogin) {
                console.log("User signed in, navigating to application");
                setShouldNavigateAfterLogin(false);
                closeModal();
                navigate(`/application?email=${encodeURIComponent(user.email)}`);
            }
        });
        return () => unsubscribe();
    }, [shouldNavigateAfterLogin, navigate]);

    const openModal = () => setIsModalOpen(true);
    const closeModal = () => setIsModalOpen(false);

    const handleSuccessfulSignIn = () => {
        console.log("handleSuccessfulSignIn called - auth state change will handle navigation");
    };

    // Check if application window is open
    const handleApplyClick = async () => {
        try {
            const base = API_BASE_URL.replace(/\/$/, ""); // strip trailing slash just in case
            const url = `${base}/api/applications/window-status`;
            console.log("Checking window status:", url);

            const { data } = await axios.get(url);
            console.log("Window status:", data);

            // Enforce only when gating is active
            if (data.isActive && !data.isOpen) {
                if (data.isBeforeStart) {
                    alert("Applications are not open yet. Please check back later!");
                    return;
                } 
                if (data.isAfterDeadline) {
                    alert("The application deadline has passed.");
                    return;
                }
                alert("Applications are currently closed.");
                return;
            }

            // Open (or gating disabled) — continue
            if (currentUser && currentUser.email) {
                console.log("User already signed in, navigating directly");
                navigate(`/application?email=${encodeURIComponent(currentUser.email)}`);
            } else {
                console.log("User not signed in, opening modal");
                setShouldNavigateAfterLogin(true);
                openModal();
            }
        } catch (err) {
            console.error("Error checking window status:", err);
            alert("Unable to check application window right now. Please try again.");
        }
    };

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
                        onClick={handleApplyClick}
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
