import React, { useState } from "react";
import AuthButton from "./AuthButton";
import Modal from "./Modal";

function HomePage() {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const openModal = () => {
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
    };

    return (
        <div className="homepage-container">
            <div className="card">
                <h1>Welcome to Triton Consulting Group</h1>
                <p>Unlocking the next era of business</p>
                
                <div className="center-button">
                    <button 
                        className="apply-button" 
                        onClick={openModal}
                    >
                        Apply Now
                    </button>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={closeModal}>
                <div className="modal-content">
                    <h2>Sign in to Continue</h2>
                    <p>Please sign in with your Google account to continue with your application.</p>
                    <div className="modal-auth-button">
                        <AuthButton onSuccessfulSignIn={closeModal} />
                    </div>
                </div>
            </Modal>
        </div>
    );
}

export default HomePage;