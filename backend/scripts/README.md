# TCG Application Portal - Scripts Directory

## 📁 Overview
This directory contains utility scripts for the TCG Application Portal backend.

## 🚀 Essential Scripts

### `createSuperAdmin.js`
**Purpose**: Creates the initial super admin user for the application
**Usage**: 
```bash
node scripts/createSuperAdmin.js
```
**When to run**: Once during initial setup or when you need to create/update the super admin

## 🧪 Testing Scripts (Development Only)

The following scripts are for development and testing purposes. They are not needed for production:

- `loadTest.js` - Initial load testing
- `bottleneckTest.js` - Bottleneck analysis
- `optimizedBottleneckTest.js` - Improved bottleneck testing  
- `scalingTest.js` - Scaling tests for 300+ applications
- `testPagination.js` - Pagination API testing
- `testFrontendPagination.js` - Frontend pagination testing
- `testPaginationWithFirstLast.js` - First/Last button testing
- `runTests.js` - Test runner helper

## 📊 Analysis Reports (Development Only)

Test result files (can be regenerated):
- `bottleneck-metrics-*.json`
- `bottleneck-analysis-*.txt`
- `optimized-bottleneck-analysis-*.txt`
- `scaling-analysis-*.txt`

## 🔧 Migration Scripts (One-time Use)

- `addStatusHistory.js` - Adds status history to existing applications
- `fixStatusHistory.js` - Fixes status history issues

## 🎯 For Collaborators

### Production Setup
1. Run `node scripts/createSuperAdmin.js` to set up the super admin
2. All other scripts are optional and for development/testing

### Development
- Use testing scripts to verify system performance
- Analysis reports help understand system bottlenecks
- Migration scripts are for one-time data fixes

## 📈 Current System Status

- **Total Applications**: 626
- **Pagination**: 30 applications per page
- **Total Pages**: 21
- **Performance**: Optimized for 300+ applications
- **Features**: First/Last pagination buttons, search, filtering

## 🔄 Recent Updates

- Added First/Last pagination buttons
- Fixed frontend to show all 626 applications
- Implemented client-side pagination with 30 apps per page
- Added comprehensive testing scripts
- Optimized database connections and rate limiting 