const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:5002/api';
const TOTAL_APPLICATIONS = 100;
const CONCURRENT_REQUESTS = 10;
const TEST_DURATION = 30000; // 30 seconds

// Test data generator
const generateTestApplication = (index) => {
  const majors = ['Computer Science', 'Business', 'Engineering', 'Arts', 'Science'];
  const years = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'];
  const candidateTypes = ['Full-time', 'Part-time', 'Intern'];
  
  return {
    email: `testuser${index}@example.com`,
    fullName: `Test User ${index}`,
    studentYear: years[Math.floor(Math.random() * years.length)],
    major: majors[Math.floor(Math.random() * majors.length)],
    appliedBefore: Math.random() > 0.5 ? 'Yes' : 'No',
    candidateType: candidateTypes[Math.floor(Math.random() * candidateTypes.length)],
    reason: `This is a test application ${index} for load testing purposes.`
  };
};

// Performance tracking
class PerformanceTracker {
  constructor() {
    this.requests = [];
    this.errors = [];
    this.startTime = Date.now();
  }

  addRequest(method, endpoint, duration, statusCode, success) {
    this.requests.push({
      method,
      endpoint,
      duration,
      statusCode,
      success,
      timestamp: Date.now()
    });

    if (!success) {
      this.errors.push({
        method,
        endpoint,
        statusCode,
        timestamp: Date.now()
      });
    }
  }

  getStats() {
    const successfulRequests = this.requests.filter(r => r.success);
    const failedRequests = this.requests.filter(r => !r.success);
    
    const durations = successfulRequests.map(r => r.duration);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
    
    const totalTime = Date.now() - this.startTime;
    const requestsPerSecond = this.requests.length / (totalTime / 1000);
    
    return {
      totalRequests: this.requests.length,
      successfulRequests: successfulRequests.length,
      failedRequests: failedRequests.length,
      successRate: (successfulRequests.length / this.requests.length) * 100,
      averageResponseTime: avgDuration,
      minResponseTime: minDuration,
      maxResponseTime: maxDuration,
      requestsPerSecond,
      totalTime,
      errors: this.errors
    };
  }

  generateReport() {
    const stats = this.getStats();
    const report = `
🚀 LOAD TEST REPORT
==================
📊 Performance Metrics:
- Total Requests: ${stats.totalRequests}
- Successful Requests: ${stats.successfulRequests}
- Failed Requests: ${stats.failedRequests}
- Success Rate: ${stats.successRate.toFixed(2)}%
- Average Response Time: ${stats.averageResponseTime.toFixed(2)}ms
- Min Response Time: ${stats.minResponseTime}ms
- Max Response Time: ${stats.maxResponseTime}ms
- Requests Per Second: ${stats.requestsPerSecond.toFixed(2)}
- Total Test Duration: ${(stats.totalTime / 1000).toFixed(2)}s

${stats.errors.length > 0 ? `
❌ Errors (${stats.errors.length}):
${stats.errors.map(err => `- ${err.method} ${err.endpoint}: ${err.statusCode}`).join('\n')}
` : '✅ No errors encountered'}

${stats.successRate >= 95 ? '🎉 EXCELLENT: Application can handle the load!' : 
  stats.successRate >= 80 ? '⚠️  GOOD: Minor issues detected' : 
  '🚨 POOR: Significant bottlenecks detected'}
`;

    console.log(report);
    
    // Save report to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(__dirname, `load-test-report-${timestamp}.txt`);
    fs.writeFileSync(reportPath, report);
    console.log(`📄 Report saved to: ${reportPath}`);
    
    return stats;
  }
}

// Helper function to make requests with timing
const makeRequest = async (method, endpoint, data = null) => {
  const startTime = Date.now();
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      timeout: 10000, // 10 second timeout
      ...(data && { data })
    };
    
    const response = await axios(config);
    const duration = Date.now() - startTime;
    
    return {
      success: true,
      duration,
      statusCode: response.status,
      data: response.data
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      duration,
      statusCode: error.response?.status || 0,
      error: error.message
    };
  }
};

// Test scenarios
const runSubmissionTest = async (tracker) => {
  console.log('\n📝 Testing Application Submissions...');
  
  const applications = Array.from({ length: TOTAL_APPLICATIONS }, (_, i) => 
    generateTestApplication(i + 1)
  );
  
  // Submit applications in batches
  for (let i = 0; i < applications.length; i += CONCURRENT_REQUESTS) {
    const batch = applications.slice(i, i + CONCURRENT_REQUESTS);
    const promises = batch.map(app => makeRequest('POST', '/applications', app));
    
    const results = await Promise.all(promises);
    
    results.forEach((result, index) => {
      tracker.addRequest('POST', '/applications', result.duration, result.statusCode, result.success);
    });
    
    // Small delay between batches to avoid overwhelming the server
    if (i + CONCURRENT_REQUESTS < applications.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`Submitted batch ${Math.floor(i / CONCURRENT_REQUESTS) + 1}/${Math.ceil(applications.length / CONCURRENT_REQUESTS)}`);
  }
};

const runRetrievalTest = async (tracker) => {
  console.log('\n📋 Testing Application Retrieval...');
  
  // Test getting all applications
  const getAllResult = await makeRequest('GET', '/applications');
  tracker.addRequest('GET', '/applications', getAllResult.duration, getAllResult.statusCode, getAllResult.success);
  
  // Test getting individual applications by email
  const testEmails = Array.from({ length: 20 }, (_, i) => `testuser${i + 1}@example.com`);
  const promises = testEmails.map(email => makeRequest('GET', `/applications/email/${email}`));
  
  const results = await Promise.all(promises);
  results.forEach(result => {
    tracker.addRequest('GET', '/applications/email/:email', result.duration, result.statusCode, result.success);
  });
};

const runConcurrentLoadTest = async (tracker) => {
  console.log('\n⚡ Testing Concurrent Load...');
  
  const concurrentRequests = Array.from({ length: 50 }, (_, i) => {
    const app = generateTestApplication(1000 + i);
    return makeRequest('POST', '/applications', app);
  });
  
  const results = await Promise.all(concurrentRequests);
  results.forEach(result => {
    tracker.addRequest('POST', '/applications', result.duration, result.statusCode, result.success);
  });
};

const runStressTest = async (tracker) => {
  console.log('\n🔥 Running Stress Test...');
  
  const startTime = Date.now();
  const requests = [];
  
  // Continuously send requests for the test duration
  while (Date.now() - startTime < TEST_DURATION) {
    const app = generateTestApplication(Math.floor(Math.random() * 10000));
    requests.push(makeRequest('POST', '/applications', app));
    
    // Add some GET requests as well
    if (Math.random() > 0.7) {
      requests.push(makeRequest('GET', '/applications'));
    }
    
    // Limit concurrent requests
    if (requests.length >= CONCURRENT_REQUESTS) {
      const batch = requests.splice(0, CONCURRENT_REQUESTS);
      const results = await Promise.all(batch);
      
      results.forEach(result => {
        tracker.addRequest('POST', '/applications', result.duration, result.statusCode, result.success);
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  // Process remaining requests
  if (requests.length > 0) {
    const results = await Promise.all(requests);
    results.forEach(result => {
      tracker.addRequest('POST', '/applications', result.duration, result.statusCode, result.success);
    });
  }
};

// Main test runner
const runLoadTest = async () => {
  console.log('🚀 Starting Load Test for TCG Application Portal');
  console.log(`📊 Target: ${TOTAL_APPLICATIONS} applications`);
  console.log(`⚡ Concurrent requests: ${CONCURRENT_REQUESTS}`);
  console.log(`⏱️  Test duration: ${TEST_DURATION / 1000}s`);
  console.log('=' .repeat(50));
  
  const tracker = new PerformanceTracker();
  
  try {
    // Test 1: Sequential submissions
    await runSubmissionTest(tracker);
    
    // Test 2: Retrieval operations
    await runRetrievalTest(tracker);
    
    // Test 3: Concurrent load
    await runConcurrentLoadTest(tracker);
    
    // Test 4: Stress test
    await runStressTest(tracker);
    
  } catch (error) {
    console.error('❌ Load test failed:', error.message);
  }
  
  // Generate final report
  console.log('\n' + '='.repeat(50));
  const stats = tracker.generateReport();
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  if (stats.successRate < 95) {
    console.log('- Consider implementing request queuing');
    console.log('- Add database connection pooling');
    console.log('- Implement caching for frequently accessed data');
    console.log('- Consider horizontal scaling');
  } else {
    console.log('- Application performs well under load');
    console.log('- Consider monitoring for production deployment');
  }
  
  process.exit(0);
};

// Check if server is running
const checkServer = async () => {
  try {
    await axios.get(`${BASE_URL.replace('/api', '')}/`, { timeout: 5000 });
    console.log('✅ Server is running');
    return true;
  } catch (error) {
    console.error('❌ Server is not running. Please start the backend server first.');
    console.error('Run: cd backend && npm start');
    return false;
  }
};

// Run the test
const main = async () => {
  const serverRunning = await checkServer();
  if (!serverRunning) {
    process.exit(1);
  }
  
  await runLoadTest();
};

main().catch(console.error); 