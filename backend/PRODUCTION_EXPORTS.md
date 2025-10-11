# Production Export Guide

This guide explains how to run case night export scripts against the production database instead of your local development database.

## Problem
When running export scripts locally, they connect to your local MongoDB instance or development database instead of the production database where the actual application data is stored.

## Solution

### Method 1: Using Production Environment File (Recommended)

1. **Update the production environment file** with your actual production database URL:
   ```bash
   # Edit backend/production.env
   MONGO_URI=your-actual-production-mongodb-connection-string
   ```

2. **Run export scripts with production flag**:
   ```bash
   # For case group assignments
   cd backend
   node scripts/assignCaseGroups.js --production
   
   # For exporting case groups
   node scripts/exportCaseGroups.js --production
   ```

### Method 2: Direct Environment Variable Override

You can also override the environment variable directly when running the script:

```bash
# Set the production MongoDB URI directly
MONGO_URI="your-production-mongodb-connection-string" node scripts/exportCaseGroups.js

# Or for assignments
MONGO_URI="your-production-mongodb-connection-string" node scripts/assignCaseGroups.js
```

### Method 3: Using Production Environment Variables

If you have production environment variables set in your shell:

```bash
# Export the production URI (replace with your actual production URI)
export MONGO_URI="mongodb+srv://username:password@cluster.mongodb.net/database"

# Then run the scripts normally
node scripts/exportCaseGroups.js
node scripts/assignCaseGroups.js
```

## Important Notes

⚠️ **Safety First**: 
- Always double-check that you're connecting to the production database
- Consider backing up data before running assignment scripts
- Test with a small dataset first if possible

🔒 **Security**: 
- Never commit production database credentials to version control
- Use environment variables or secure configuration files
- The `production.env` file should be added to `.gitignore`

## Verification

To verify you're connected to the production database, the scripts will show:
- Connection confirmation with the database host
- Count of applications/assignments found
- Export file location and summary

## Troubleshooting

**Connection Issues**:
- Verify the MongoDB connection string is correct
- Check if your IP is whitelisted in MongoDB Atlas (if using Atlas)
- Ensure the database user has proper permissions

**No Data Found**:
- Confirm you're connected to the right database
- Check if the collection names match between environments
- Verify the data exists in the production database

## Example Workflow

```bash
# 1. Navigate to backend directory
cd backend

# 2. Update production.env with correct MongoDB URI
# (Edit the file with your actual production connection string)

# 3. Run case group assignments against production data
node scripts/assignCaseGroups.js --production

# 4. Export the assignments to CSV
node scripts/exportCaseGroups.js --production

# 5. Check the exports directory for your CSV file
ls exports/
```

The exported CSV file will be saved in `backend/exports/` with a timestamp in the filename.
