# AWS S3 Configuration Guide

## Overview
This application now supports both local file storage (for development) and AWS S3 storage (for production). Files are automatically stored in S3 when properly configured, with fallback to local storage.

## Environment Variables

Add these to your `.env` file for S3 storage:

```bash
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-west-2
S3_BUCKET_NAME=tcg-application-portal-files

# Optional: CloudFront CDN for faster file access
CLOUDFRONT_DOMAIN=your-cloudfront-domain.cloudfront.net
```

## AWS Setup Instructions

### 1. Create S3 Bucket
1. Go to AWS S3 Console
2. Create a new bucket with name: `tcg-application-portal-files`
3. Configure bucket permissions for public read access
4. Enable CORS if needed

### 2. Create IAM User
1. Go to AWS IAM Console
2. Create a new user with programmatic access
3. Attach policy with S3 permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:GetObject",
           "s3:PutObject",
           "s3:DeleteObject",
           "s3:PutObjectAcl"
         ],
         "Resource": "arn:aws:s3:::tcg-application-portal-files/*"
       },
       {
         "Effect": "Allow",
         "Action": [
           "s3:ListBucket"
         ],
         "Resource": "arn:aws:s3:::tcg-application-portal-files"
       }
     ]
   }
   ```

### 3. Bucket Policy (for public read access)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::tcg-application-portal-files/*"
    }
  ]
}
```

## File Structure in S3
Files are organized in the following structure:
```
tcg-application-portal-files/
├── resumes/
│   └── 1234567890-resume.pdf
├── transcripts/
│   └── 1234567890-transcript.pdf
├── images/
│   └── 1234567890-profile.jpg
└── other/
    └── 1234567890-document.pdf
```

## Benefits of S3 Storage

### ✅ Production Ready
- Files persist across server restarts
- Multiple server instances can access the same files
- Scalable and reliable

### ✅ Global Access
- Files accessible from anywhere
- CDN support for faster loading
- No server bandwidth usage for file serving

### ✅ Security
- Fine-grained access control
- Signed URLs for private files
- Automatic backup and versioning

## Development vs Production

### Development (Local Storage)
- Files stored in `backend/uploads/` directory
- No AWS configuration needed
- Files lost on server restart

### Production (S3 Storage)
- Files stored in AWS S3
- Requires AWS credentials
- Files persist and are globally accessible

## Migration from Local to S3

If you have existing files in local storage, you can migrate them to S3 using the migration script (to be created if needed).

## Testing

1. **Without S3**: Files stored locally, accessible via `/uploads/filename`
2. **With S3**: Files stored in S3, accessible via S3 URLs or CloudFront

The application automatically detects S3 configuration and switches between storage methods.
