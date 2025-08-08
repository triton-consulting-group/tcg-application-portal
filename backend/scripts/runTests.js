const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Setting up Bottleneck Testing Environment...\n');

// Check if we're in the right directory
const currentDir = process.cwd();
const packageJsonPath = path.join(currentDir, 'package.json');

if (!fs.existsSync(packageJsonPath)) {
  console.error('❌ Error: package.json not found. Please run this script from the backend directory.');
  process.exit(1);
}

try {
  // Install dependencies if needed
  console.log('📦 Installing dependencies...');
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependencies installed successfully\n');

  // Check if server is running
  console.log('🔍 Checking if server is running...');
  try {
    execSync('curl -s http://localhost:5002/ > /dev/null', { stdio: 'pipe' });
    console.log('✅ Server is running on port 5002\n');
  } catch (error) {
    console.log('⚠️  Server not running. Starting server...');
    console.log('📝 Note: Keep this terminal open and run the test in another terminal');
    
    // Start the server
    execSync('node server.js', { stdio: 'inherit' });
  }

} catch (error) {
  console.error('❌ Error during setup:', error.message);
  process.exit(1);
}

console.log('🎯 Ready to run bottleneck tests!');
console.log('\nTo run the tests, use one of these commands:');
console.log('1. Basic load test:    node scripts/loadTest.js');
console.log('2. Bottleneck analysis: node scripts/bottleneckTest.js');
console.log('\nThe tests will:');
console.log('- Create 100 test applications');
console.log('- Test concurrent load scenarios');
console.log('- Analyze performance bottlenecks');
console.log('- Generate detailed reports'); 