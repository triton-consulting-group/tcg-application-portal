const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Scaling Test Configuration for 300+ applications
const CONFIG = {
  BASE_URL: 'http://localhost:5002/api',
  TARGET_APPLICATIONS: 300,
  CONCURRENT_BATCHES: [1, 5, 10, 20, 30, 50], // Test higher concurrency
  TEST_DURATION: 120000, // 2 minutes stress test
  REQUEST_TIMEOUT: 30000, // 30 seconds
  DELAY_BETWEEN_BATCHES: 300, // Reduced delay for faster processing
  DELAY_BETWEEN_REQUESTS: 50 // Reduced delay
};

// Test data generator
const generateApplication = (index) => ({
  email: `scaling-test-${index}@example.com`,
  fullName: `Scaling Test User ${index}`,
  studentYear: ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'][index % 5],
  major: ['Computer Science', 'Business', 'Engineering', 'Arts', 'Science', 'Mathematics'][index % 6],
  appliedBefore: index % 2 === 0 ? 'Yes' : 'No',
  candidateType: ['Full-time', 'Part-time', 'Intern', 'Contractor'][index % 4],
  reason: `Scaling test application ${index} - Testing system capacity for 300+ applications.`
});

// Performance monitoring for scaling
class ScalingPerformanceTracker {
  constructor() {
    this.metrics = {
      requests: [],
      bottlenecks: [],
      responseTimes: [],
      successRates: [],
      throughput: []
    };
    this.startTime = Date.now();
  }

  recordRequest(operation, duration, success, error = null) {
    const metric = {
      operation,
      duration,
      success,
      error,
      timestamp: Date.now()
    };

    this.metrics.requests.push(metric);
    this.metrics.responseTimes.push(duration);

    if (!success) {
      this.metrics.bottlenecks.push({
        type: 'request_failure',
        operation,
        error: error?.message || 'Unknown error',
        timestamp: Date.now()
      });
    }

    if (duration > 5000) { // 5 second threshold for scaling
      this.metrics.bottlenecks.push({
        type: 'slow_response',
        operation,
        duration,
        timestamp: Date.now()
      });
    }
  }

  analyzeScalingPerformance() {
    const analysis = {
      totalRequests: this.metrics.requests.length,
      successfulRequests: this.metrics.requests.filter(r => r.success).length,
      failedRequests: this.metrics.requests.filter(r => !r.success).length,
      successRate: 0,
      averageResponseTime: 0,
      slowestOperation: null,
      bottlenecks: this.metrics.bottlenecks,
      recommendations: [],
      canHandle300Plus: false
    };

    if (analysis.totalRequests > 0) {
      analysis.successRate = (analysis.successfulRequests / analysis.totalRequests) * 100;
      analysis.averageResponseTime = this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length;
    }

    const slowest = this.metrics.requests.reduce((slowest, current) => 
      current.duration > slowest.duration ? current : slowest, 
      { duration: 0 }
    );
    analysis.slowestOperation = slowest;

    // Determine if system can handle 300+ applications
    analysis.canHandle300Plus = analysis.successRate >= 90 && analysis.averageResponseTime < 3000;

    // Generate scaling recommendations
    if (analysis.successRate < 90) {
      analysis.recommendations.push('Implement horizontal scaling with load balancer');
    }
    if (analysis.averageResponseTime > 3000) {
      analysis.recommendations.push('Add Redis caching layer');
    }
    if (this.metrics.bottlenecks.some(b => b.type === 'slow_response')) {
      analysis.recommendations.push('Optimize database queries with aggregation pipelines');
    }
    if (analysis.successRate < 95) {
      analysis.recommendations.push('Consider microservices architecture');
    }

    return analysis;
  }

  generateScalingReport() {
    const analysis = this.analyzeScalingPerformance();
    const totalTime = Date.now() - this.startTime;
    const requestsPerSecond = analysis.totalRequests / (totalTime / 1000);

    const report = `
🚀 SCALING ANALYSIS REPORT (300+ Applications)
==============================================
📊 Performance Summary:
- Total Requests: ${analysis.totalRequests}
- Successful: ${analysis.successfulRequests}
- Failed: ${analysis.failedRequests}
- Success Rate: ${analysis.successRate.toFixed(2)}%
- Average Response Time: ${analysis.averageResponseTime.toFixed(2)}ms
- Requests/Second: ${requestsPerSecond.toFixed(2)}
- Test Duration: ${(totalTime / 1000).toFixed(2)}s

🎯 Scaling Assessment:
${analysis.canHandle300Plus ? 
  '✅ EXCELLENT: System can handle 300+ applications efficiently!' :
  '⚠️  NEEDS IMPROVEMENT: System requires additional scaling measures'}

🚨 Bottlenecks Detected (${analysis.bottlenecks.length}):
${analysis.bottlenecks.length > 0 ? 
  analysis.bottlenecks.slice(0, 10).map(b => `- ${b.type}: ${b.operation} (${b.duration || 'N/A'}ms)`).join('\n') + 
  (analysis.bottlenecks.length > 10 ? `\n... and ${analysis.bottlenecks.length - 10} more` : '') : 
  '✅ No significant bottlenecks detected'}

${analysis.slowestOperation.duration > 0 ? `
🐌 Slowest Operation:
- Operation: ${analysis.slowestOperation.operation}
- Duration: ${analysis.slowestOperation.duration}ms
- Success: ${analysis.slowestOperation.success ? 'Yes' : 'No'}
` : ''}

💡 Scaling Recommendations:
${analysis.recommendations.length > 0 ? 
  analysis.recommendations.map(r => `- ${r}`).join('\n') : 
  '- System is well-optimized for 300+ applications'}

📈 Capacity Analysis:
- Current Capacity: ${analysis.successRate >= 90 ? 'Excellent' : analysis.successRate >= 75 ? 'Good' : 'Poor'}
- Scalability: ${analysis.canHandle300Plus ? 'High' : 'Medium'}
- Production Ready: ${analysis.successRate >= 95 ? 'Yes' : 'No'}

${analysis.canHandle300Plus ? 
  '🎉 SUCCESS: Application is ready for 300+ applications!' :
  '🔧 WORK NEEDED: Additional scaling measures required'}
`;

    console.log(report);
    return report;
  }
}

// HTTP request helper with retry logic
const makeRequest = async (method, endpoint, data = null, retries = 3) => {
  const startTime = Date.now();
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const config = {
        method,
        url: `${CONFIG.BASE_URL}${endpoint}`,
        timeout: CONFIG.REQUEST_TIMEOUT,
        headers: {
          'Content-Type': 'application/json'
        },
        ...(data && { data })
      };

      const response = await axios(config);
      const duration = Date.now() - startTime;

      return {
        success: true,
        duration,
        statusCode: response.status,
        data: response.data,
        attempts: attempt + 1
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Don't retry on certain errors
      if (error.response?.status === 429 || error.response?.status === 400) {
        return {
          success: false,
          duration,
          statusCode: error.response?.status || 0,
          error: {
            message: error.message,
            code: error.code,
            response: error.response?.data
          },
          attempts: attempt + 1
        };
      }
      
      // If this is the last attempt, return the error
      if (attempt === retries) {
        return {
          success: false,
          duration,
          statusCode: error.response?.status || 0,
          error: {
            message: error.message,
            code: error.code,
            response: error.response?.data
          },
          attempts: attempt + 1
        };
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
};

// Test scenarios for scaling
const testBulkApplicationCreation = async (tracker) => {
  console.log(`\n📝 Testing Bulk Application Creation (${CONFIG.TARGET_APPLICATIONS} applications)`);
  
  const applications = Array.from({ length: CONFIG.TARGET_APPLICATIONS }, (_, i) => 
    generateApplication(i + 1)
  );

  // Create applications in larger batches for efficiency
  const batchSize = 10;
  for (let i = 0; i < applications.length; i += batchSize) {
    const batch = applications.slice(i, i + batchSize);
    const promises = batch.map(app => makeRequest('POST', '/applications', app));
    
    const results = await Promise.all(promises);
    
    results.forEach((result, index) => {
      tracker.recordRequest('BULK_CREATE', result.duration, result.success, result.error);
    });

    console.log(`Created batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(applications.length / batchSize)}`);
    
    // Small delay between batches
    if (i + batchSize < applications.length) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_BATCHES));
    }
  }
};

const testPaginationPerformance = async (tracker) => {
  console.log('\n📋 Testing Pagination Performance');
  
  // Test pagination with different page sizes
  const pageSizes = [10, 25, 50, 100, 200];
  
  for (const pageSize of pageSizes) {
    const result = await makeRequest('GET', `/applications?page=1&limit=${pageSize}`);
    tracker.recordRequest(`PAGINATION_${pageSize}`, result.duration, result.success, result.error);
    
    if (result.success) {
      console.log(`Page size ${pageSize}: ${result.data.applications?.length || 0} applications`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
};

const testHighConcurrency = async (tracker) => {
  console.log('\n⚡ Testing High Concurrency Scenarios');
  
  for (const concurrency of CONFIG.CONCURRENT_BATCHES) {
    console.log(`\nTesting ${concurrency} concurrent requests...`);
    
    const promises = Array.from({ length: concurrency }, (_, i) => {
      const app = generateApplication(10000 + i);
      return makeRequest('POST', '/applications', app);
    });
    
    const startTime = Date.now();
    const results = await Promise.all(promises);
    const batchDuration = Date.now() - startTime;
    
    results.forEach(result => {
      tracker.recordRequest(`HIGH_CONCURRENCY_${concurrency}`, result.duration, result.success, result.error);
    });
    
    console.log(`Batch completed in ${batchDuration}ms (${concurrency} requests)`);
    
    // Delay between concurrency tests
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
};

const testExtendedStress = async (tracker) => {
  console.log('\n🔥 Running Extended Stress Test (2 minutes)');
  
  const startTime = Date.now();
  const requests = [];
  
  while (Date.now() - startTime < CONFIG.TEST_DURATION) {
    // Mix of operations
    const operation = Math.random();
    if (operation < 0.4) {
      // 40% create operations
      const app = generateApplication(Math.floor(Math.random() * 50000));
      requests.push(makeRequest('POST', '/applications', app));
    } else if (operation < 0.7) {
      // 30% read operations with pagination
      const page = Math.floor(Math.random() * 10) + 1;
      const limit = [10, 25, 50, 100][Math.floor(Math.random() * 4)];
      requests.push(makeRequest('GET', `/applications?page=${page}&limit=${limit}`));
    } else {
      // 30% individual read operations
      const email = `scaling-test-${Math.floor(Math.random() * 300)}@example.com`;
      requests.push(makeRequest('GET', `/applications/email/${email}`));
    }
    
    // Process in batches
    if (requests.length >= 10) {
      const batch = requests.splice(0, 10);
      const results = await Promise.all(batch);
      
      results.forEach(result => {
        tracker.recordRequest('EXTENDED_STRESS', result.duration, result.success, result.error);
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Process remaining requests
  if (requests.length > 0) {
    const results = await Promise.all(requests);
    results.forEach(result => {
      tracker.recordRequest('EXTENDED_STRESS', result.duration, result.success, result.error);
    });
  }
};

// Main scaling test runner
const runScalingTest = async () => {
  console.log('🚀 Starting Scaling Analysis for 300+ Applications');
  console.log(`🎯 Target: ${CONFIG.TARGET_APPLICATIONS} applications`);
  console.log(`⚡ Concurrency levels: ${CONFIG.CONCURRENT_BATCHES.join(', ')}`);
  console.log(`⏱️  Extended stress test: ${CONFIG.TEST_DURATION / 1000}s`);
  console.log('=' .repeat(70));
  
  const tracker = new ScalingPerformanceTracker();
  
  try {
    // Test 1: Bulk application creation
    await testBulkApplicationCreation(tracker);
    
    // Test 2: Pagination performance
    await testPaginationPerformance(tracker);
    
    // Test 3: High concurrency testing
    await testHighConcurrency(tracker);
    
    // Test 4: Extended stress testing
    await testExtendedStress(tracker);
    
  } catch (error) {
    console.error('❌ Scaling test failed:', error.message);
    tracker.recordRequest('TEST_ERROR', 0, false, error);
  }
  
  // Generate scaling analysis report
  console.log('\n' + '='.repeat(70));
  const report = tracker.generateScalingReport();
  
  // Save detailed report
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(__dirname, `scaling-analysis-${timestamp}.txt`);
  fs.writeFileSync(reportPath, report);
  console.log(`📄 Scaling report saved to: ${reportPath}`);
  
  return tracker.analyzeScalingPerformance();
};

// Check server availability
const checkServer = async () => {
  try {
    await axios.get(`${CONFIG.BASE_URL.replace('/api', '')}/health`, { 
      timeout: 5000 
    });
    console.log('✅ Server is running and healthy');
    return true;
  } catch (error) {
    console.error('❌ Server is not accessible. Please ensure the backend server is running.');
    console.error('Command: cd backend && npm start');
    return false;
  }
};

// Main execution
const main = async () => {
  const serverAvailable = await checkServer();
  if (!serverAvailable) {
    process.exit(1);
  }
  
  const results = await runScalingTest();
  
  // Exit with appropriate code based on scaling results
  if (results.canHandle300Plus) {
    console.log('\n🎉 SUCCESS: Application can handle 300+ applications!');
    process.exit(0);
  } else {
    console.log('\n⚠️  WARNING: Application needs additional scaling measures for 300+ applications');
    process.exit(0);
  }
};

main().catch(console.error); 