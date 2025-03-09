import React, { useState } from "react";
import { useNavigate } from "react-router-dom"
import AuthButton from "./AuthButton";
import Modal from "./Modal";
import { 
    Box, 
    Button, 
    VStack, 
    Heading, 
    Text, 
    Flex, 
    Image 
} from "@chakra-ui/react";
import logo from "../../logo.png";

function HomePage() {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const navigate = useNavigate();

    const openModal = () => {
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
    };

    const handleSuccessfulSignIn = () => {
        closeModal();
        navigate('/application');
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