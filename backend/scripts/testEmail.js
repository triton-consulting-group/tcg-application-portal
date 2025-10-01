const mongoose = require('mongoose');
const { emailService } = require('../config/emailConfig');
require('dotenv').config();

const testEmail = async () => {
  try {
    console.log('🧪 Testing email configuration...');
    
    // Test email configuration
    const configTest = await emailService.testEmailConfig();
    if (!configTest.success) {
      console.error('❌ Email configuration test failed:', configTest.error);
      return;
    }
    
    console.log('✅ Email configuration is valid');
    
    // Test sending a sample confirmation email
    const sampleApplication = {
      _id: 'test-application-id',
      email: process.env.TEST_EMAIL,
      fullName: 'Test User',
      studentYear: 'Junior',
      major: 'Computer Science',
      candidateType: 'Student',
      appliedBefore: 'No',
      reason: 'Test application for email functionality'
    };
    
    console.log('📧 Sending test confirmation email to:', sampleApplication.email);
    
    const emailResult = await emailService.sendApplicationConfirmation(sampleApplication);
    
    if (emailResult.success) {
      console.log('✅ Test email sent successfully!');
      console.log('📧 Message ID:', emailResult.messageId);
    } else {
      console.error('❌ Failed to send test email:', emailResult.error);
    }
    
  } catch (error) {
    console.error('❌ Error during email test:', error);
  }
};

// Run the test
testEmail();

