# Vercel Full-Stack Deployment Guide

## Option 1: Deploy Everything on Vercel (Recommended)

### Frontend Environment Variables
Create: frontend/.env.production
```
REACT_APP_API_BASE_URL=https://applytcg.vercel.app
```

### Backend Environment Variables (Set in Vercel Dashboard)
```
MONGO_URI=your-mongodb-connection-string
EMAIL_USER=your-email@gmail.com
EMAIL_APP_PASSWORD=your-gmail-app-password
EMAIL_FROM=noreply@tcg-portal.com
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
S3_BUCKET_NAME=your-s3-bucket-name
AWS_REGION=your-aws-region
FRONTEND_URL=https://applytcg.vercel.app
BACKEND_URL=https://applytcg.vercel.app
NODE_ENV=production
```

## Option 2: Railway + Vercel (Alternative)

### Railway Backend Environment Variables
Same as above but with Railway URL

### Vercel Frontend Environment Variables
```
REACT_APP_API_BASE_URL=https://your-backend-url.railway.app
```

## Security Note
Never commit actual credentials to your repository. Use environment variables in your hosting platform's dashboard.
