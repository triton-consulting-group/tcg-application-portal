# Email Functionality Setup Guide

This guide explains how to set up and use the email functionality in the TCG Application Portal backend.

## Overview

The email functionality automatically sends confirmation emails to users when they submit applications. It's designed to be robust and won't fail application submissions if emails fail to send.

## Features

- ✅ Automatic confirmation emails on application submission
- ✅ Professional HTML email templates
- ✅ Fallback plain text versions
- ✅ Multiple email service support (Gmail, SMTP)
- ✅ Error handling that doesn't break application flow
- ✅ Configurable email settings

## Setup Instructions

### 1. Install Dependencies

The required dependencies are already installed:

```bash
npm install nodemailer
```

### 2. Environment Configuration

Create a `.env` file in the `backend/` directory with the following variables:

#### For Gmail (Development/Testing)

```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_APP_PASSWORD=your-gmail-app-password
EMAIL_FROM=noreply@tcg-portal.com
```

#### For SMTP (Production)

```env
EMAIL_SERVICE=smtp
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
EMAIL_FROM=noreply@tcg-portal.com
```

### 3. Gmail App Password Setup

If using Gmail, you'll need to create an App Password:

1. Go to your Google Account settings
2. Navigate to Security → 2-Step Verification
3. Generate an App Password for "Mail"
4. Use this password in your `EMAIL_APP_PASSWORD` variable

**Important**: Never use your regular Gmail password. Always use an App Password.

### 4. Test Email Configuration

Run the test script to verify your email setup:

```bash
cd backend
node scripts/testEmail.js
```

This will:

- Test your email configuration
- Send a sample confirmation email
- Verify everything is working correctly

## How It Works

### 1. Application Submission Flow

1. User submits application
2. Application is saved to database
3. Confirmation email is sent automatically
4. User receives professional confirmation email
5. Application submission completes successfully

### 2. Email Template

The confirmation email includes:

- Professional branding and styling
- Application details summary
- Next steps information
- Contact information
- Both HTML and plain text versions

### 3. Error Handling

- Email failures don't break application submissions
- All email errors are logged for debugging
- Graceful fallback if email service is unavailable

## Email Templates

### Application Confirmation Email

The confirmation email template includes:

- ✅ Success message
- 📋 Application details table
- ⏳ Next steps information
- 📧 Contact information
- 🔒 Professional styling

### Customizing Templates

To customize email templates, edit the `emailTemplates` object in `config/emailConfig.js`:

```javascript
const emailTemplates = {
  applicationConfirmation: (applicationData) => ({
    subject: `Your Custom Subject`,
    html: `Your custom HTML template`,
    text: `Your custom plain text template`,
  }),
};
```

## Production Considerations

### Email Service Providers

For production, consider using:

- **SendGrid**: Reliable, scalable, good deliverability
- **AWS SES**: Cost-effective, high deliverability
- **Mailgun**: Developer-friendly, good analytics
- **Postmark**: Excellent deliverability for transactional emails

### Security Best Practices

1. Use environment variables for all sensitive data
2. Never commit `.env` files to version control
3. Use App Passwords for Gmail
4. Implement rate limiting for email sending
5. Monitor email delivery and bounce rates

### Monitoring and Logging

The system logs all email activities:

- ✅ Successful email sends
- ⚠️ Email failures
- ❌ Configuration errors

Monitor these logs to ensure email delivery is working correctly.

## Troubleshooting

### Common Issues

1. **"Invalid login" error**

   - Check your email credentials
   - Verify App Password is correct (for Gmail)
   - Ensure 2FA is enabled (for Gmail)

2. **"Connection timeout" error**

   - Check your internet connection
   - Verify SMTP settings
   - Check firewall settings

3. **Emails not sending**
   - Run the test script: `node scripts/testEmail.js`
   - Check environment variables
   - Verify email service configuration

### Debug Mode

Enable detailed logging by setting:

```env
NODE_ENV=development
```

### Testing

Use the test script to verify functionality:

```bash
node scripts/testEmail.js
```

## API Integration

The email functionality is automatically integrated into the application submission endpoint:

```javascript
POST / api / applications;
```

When an application is submitted:

1. Application is saved
2. Confirmation email is sent
3. Response is returned to user

## Support

If you encounter issues:

1. Check the logs for error messages
2. Verify your environment configuration
3. Test with the email test script
4. Check your email service provider's status

## Future Enhancements

Potential improvements:

- Email queue system for high-volume scenarios
- Email templates for status updates
- Admin notification emails
- Email analytics and tracking
- Multi-language email support

