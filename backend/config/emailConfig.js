const nodemailer = require('nodemailer');

// Email transporter configuration
const createTransporter = () => {

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD
    }
  });

};

// Email templates
const emailTemplates = {
  applicationConfirmation: (applicationData) => ({
    subject: `Application Confirmation - Triton Consulting Group`,
    html: `
${process.env.LOGO_URL ? `<img src="${process.env.LOGO_URL}" alt="TCG Logo" style="max-width: 150px; height: auto; margin-bottom: 5px; display: block; border: 0; outline: none; text-decoration: none;" /><br><br>` : ''}

Dear ${applicationData.fullName},<br><br>

Thank you for submitting your application to Triton Consulting Group. We have received your application and it is currently under review.<br><br>

You can view and edit your application at any time by clicking <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/application/${applicationData._id}">here.</a><br><br>

WHAT HAPPENS NEXT:<br>
1. Your application is currently under review.<br>
2. You will receive updates on your application status via email.<br>
3. If selected, you will be invited to participate in Case Study Night.<br>
4. Final decisions will be communicated within the specified timeline.<br><br>

Thank you for your interest in TCG!
    `,
    text: `
Dear ${applicationData.fullName},

Thank you for submitting your application to Triton Consulting Group. We have received your application and it is currently under review.

You can view and edit your application at any time by visiting: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/application/${applicationData._id}

WHAT HAPPENS NEXT:
1. Your application is currently under review.
2. You will receive updates on your application status via email.
3. If selected, you will be invited to participate in Case Study Night.
4. Final decisions will be communicated within the specified timeline.

Thank you for your interest in TCG!
    `
  })
};

// Email service functions
const emailService = {
  // Send application confirmation email
  sendApplicationConfirmation: async (applicationData) => {
    try {
      // Check if required environment variables are set
      if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
        console.warn('⚠️ Email environment variables not configured, skipping email send');
        return { success: false, error: 'Email configuration not set up' };
      }
      
      const transporter = createTransporter();
      const template = emailTemplates.applicationConfirmation(applicationData);
      
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: applicationData.email,
        subject: template.subject,
        html: template.html,
        text: template.text
      };
      
      const result = await transporter.sendMail(mailOptions);
      console.log('✅ Confirmation email sent successfully to:', applicationData.email);
      return { success: true, messageId: result.messageId };
      
    } catch (error) {
      console.error('❌ Error sending confirmation email:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Test email configuration
  testEmailConfig: async () => {
    try {
      // Check if required environment variables are set
      if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
        return { success: false, error: 'Email environment variables not configured' };
      }
      
      const transporter = createTransporter();
      await transporter.verify();
      console.log('✅ Email configuration is valid');
      return { success: true, message: 'Email configuration is valid' };
    } catch (error) {
      console.error('❌ Email configuration error:', error);
      return { success: false, error: error.message };
    }
  }
};

module.exports = { emailService, createTransporter };
