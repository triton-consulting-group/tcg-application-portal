const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Optimized Bottleneck Test Configuration
const CONFIG = {
  BASE_URL: 'http://localhost:5002/api',
  TARGET_APPLICATIONS: 100,
  CONCURRENT_BATCHES: [1, 5, 10, 20, 30], // Reduced max concurrency
  TEST_DURATION: 30000, // 30 seconds stress test
  REQUEST_TIMEOUT: 10000, // 10 seconds
  DELAY_BETWEEN_BATCHES: 500, // Increased delay
  DELAY_BETWEEN_REQUESTS: 100 // Small delay between individual requests
};

// Test data generator
const generateApplication = (index) => ({
  email: `optimized-test-${index}@example.com`,
  fullName: `Optimized Test User ${index}`,
  studentYear: ['Freshman', 'Sophomore', 'Junior', 'Senior'][index % 4],
  major: ['Computer Science', 'Business', 'Engineering', 'Arts'][index % 4],
  appliedBefore: index % 2 === 0 ? 'Yes' : 'No',
  candidateType: ['Full-time', 'Part-time', 'Intern'][index % 3],
  reason: `Optimized test application ${index} - Testing improved system performance.`
});

// Performance monitoring
class OptimizedPerformanceTracker {
  constructor() {
    this.metrics = {
      requests: [],
      bottlenecks: [],
      databaseOperations: [],
      responseTimes: [],
      successRates: []
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

    if (duration > 3000) { // Reduced threshold to 3 seconds
      this.metrics.bottlenecks.push({
        type: 'slow_response',
        operation,
        duration,
        timestamp: Date.now()
      });
    }
  }

  analyzePerformance() {
    const analysis = {
      totalRequests: this.metrics.requests.length,
      successfulRequests: this.metrics.requests.filter(r => r.success).length,
      failedRequests: this.metrics.requests.filter(r => !r.success).length,
      successRate: 0,
      averageResponseTime: 0,
      slowestOperation: null,
      bottlenecks: this.metrics.bottlenecks,
      recommendations: []
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

    // Generate recommendations based on performance
    if (analysis.successRate < 95) {
      analysis.recommendations.push('Consider implementing request queuing');
    }
    if (analysis.averageResponseTime > 1500) {
      analysis.recommendations.push('Optimize database queries further');
    }
    if (this.metrics.bottlenecks.some(b => b.type === 'slow_response')) {
      analysis.recommendations.push('Consider implementing caching');
    }

    return analysis;
  }

  generateReport() {
    const analysis = this.analyzePerformance();
    const totalTime = Date.now() - this.startTime;
    const requestsPerSecond = analysis.totalRequests / (totalTime / 1000);

    const report = `
🚀 OPTIMIZED BOTTLENECK ANALYSIS REPORT
======================================
📊 Performance Summary:
- Total Requests: ${analysis.totalRequests}
- Successful: ${analysis.successfulRequests}
- Failed: ${analysis.failedRequests}
- Success Rate: ${analysis.successRate.toFixed(2)}%
- Average Response Time: ${analysis.averageResponseTime.toFixed(2)}ms
- Requests/Second: ${requestsPerSecond.toFixed(2)}
- Test Duration: ${(totalTime / 1000).toFixed(2)}s

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

💡 Recommendations:
${analysis.recommendations.length > 0 ? 
  analysis.recommendations.map(r => `- ${r}`).join('\n') : 
  '- Application performs well under load'}

${analysis.successRate >= 95 && analysis.averageResponseTime < 1500 ? 
  '🎉 EXCELLENT: Optimizations successful! Application can handle 100+ applications efficiently!' :
  analysis.successRate >= 80 ? 
  '⚠️  GOOD: Significant improvement, minor optimizations still needed' :
  '🚨 NEEDS WORK: Further optimizations required'}
`;

    console.log(report);
    return report;
  }
}

// HTTP request helper with retry logic
const makeRequest = async (method, endpoint, data = null, retries = 2) => {
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
      await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
    }
  }
};

// Test scenarios with improved pacing
const testApplicationCreation = async (tracker, batchSize) => {
  console.log(`\n📝 Testing Application Creation (Batch Size: ${batchSize})`);
  
  const applications = Array.from({ length: CONFIG.TARGET_APPLICATIONS }, (_, i) => 
    generateApplication(i + 1)
  );

  for (let i = 0; i < applications.length; i += batchSize) {
    const batch = applications.slice(i, i + batchSize);
    const promises = batch.map(app => makeRequest('POST', '/applications', app));
    
    const results = await Promise.all(promises);
    
    results.forEach((result, index) => {
      tracker.recordRequest('CREATE_APPLICATION', result.duration, result.success, result.error);
    });

    console.log(`Created batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(applications.length / batchSize)}`);
    
    // Increased delay between batches
    if (i + batchSize < applications.length) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_BATCHES));
    }
  }
};

const testApplicationRetrieval = async (tracker) => {
  console.log('\n📋 Testing Application Retrieval');
  
  // Test bulk retrieval
  const bulkResult = await makeRequest('GET', '/applications');
  tracker.recordRequest('GET_ALL_APPLICATIONS', bulkResult.duration, bulkResult.success, bulkResult.error);
  
  // Test individual retrievals with delays
  for (let i = 1; i <= 20; i++) {
    const result = await makeRequest('GET', `/applications/email/optimized-test-${i}@example.com`);
    tracker.recordRequest('GET_APPLICATION_BY_EMAIL', result.duration, result.success, result.error);
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_REQUESTS));
  }
};

const testConcurrentLoad = async (tracker) => {
  console.log('\n⚡ Testing Concurrent Load Scenarios');
  
  for (const concurrency of CONFIG.CONCURRENT_BATCHES) {
    console.log(`\nTesting ${concurrency} concurrent requests...`);
    
    const promises = Array.from({ length: concurrency }, (_, i) => {
      const app = generateApplication(1000 + i);
      return makeRequest('POST', '/applications', app);
    });
    
    const startTime = Date.now();
    const results = await Promise.all(promises);
    const batchDuration = Date.now() - startTime;
    
    results.forEach(result => {
      tracker.recordRequest(`CONCURRENT_CREATE_${concurrency}`, result.duration, result.success, result.error);
    });
    
    console.log(`Batch completed in ${batchDuration}ms (${concurrency} requests)`);
    
    // Delay between concurrency tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
};

const testStressScenario = async (tracker) => {
  console.log('\n🔥 Running Optimized Stress Test');
  
  const startTime = Date.now();
  const requests = [];
  
  while (Date.now() - startTime < CONFIG.TEST_DURATION) {
    // Mix of operations with better pacing
    const operation = Math.random();
    if (operation < 0.5) {
      // 50% create operations
      const app = generateApplication(Math.floor(Math.random() * 10000));
      requests.push(makeRequest('POST', '/applications', app));
    } else if (operation < 0.8) {
      // 30% read operations
      requests.push(makeRequest('GET', '/applications'));
    } else {
      // 20% individual read operations
      const email = `optimized-test-${Math.floor(Math.random() * 100)}@example.com`;
      requests.push(makeRequest('GET', `/applications/email/${email}`));
    }
    
    // Process in smaller batches
    if (requests.length >= 5) {
      const batch = requests.splice(0, 5);
      const results = await Promise.all(batch);
      
      results.forEach(result => {
        tracker.recordRequest('STRESS_TEST', result.duration, result.success, result.error);
      });
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  // Process remaining requests
  if (requests.length > 0) {
    const results = await Promise.all(requests);
    results.forEach(result => {
      tracker.recordRequest('STRESS_TEST', result.duration, result.success, result.error);
    });
  }
};

// Main optimized test runner
const runOptimizedBottleneckTest = async () => {
  console.log('🚀 Starting Optimized Bottleneck Analysis for TCG Application Portal');
  console.log(`🎯 Target: ${CONFIG.TARGET_APPLICATIONS} applications`);
  console.log(`⚡ Concurrency levels: ${CONFIG.CONCURRENT_BATCHES.join(', ')}`);
  console.log(`⏱️  Stress test duration: ${CONFIG.TEST_DURATION / 1000}s`);
  console.log('=' .repeat(60));
  
  const tracker = new OptimizedPerformanceTracker();
  
  try {
    // Test 1: Sequential application creation
    await testApplicationCreation(tracker, 5);
    
    // Test 2: Application retrieval
    await testApplicationRetrieval(tracker);
    
    // Test 3: Concurrent load testing
    await testConcurrentLoad(tracker);
    
    // Test 4: Stress testing
    await testStressScenario(tracker);
    
  } catch (error) {
    console.error('❌ Optimized bottleneck test failed:', error.message);
    tracker.recordRequest('TEST_ERROR', 0, false, error);
  }
  
  // Generate analysis report
  console.log('\n' + '='.repeat(60));
  const report = tracker.generateReport();
  
  // Save detailed report
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(__dirname, `optimized-bottleneck-analysis-${timestamp}.txt`);
  fs.writeFileSync(reportPath, report);
  console.log(`📄 Optimized report saved to: ${reportPath}`);
  
  return tracker.analyzePerformance();
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
  
  const results = await runOptimizedBottleneckTest();
  
  // Exit with appropriate code based on results
  if (results.successRate < 80) {
    console.log('\n🚨 CRITICAL: Application still has significant bottlenecks');
    process.exit(1);
  } else if (results.successRate < 95) {
    console.log('\n⚠️  WARNING: Application has minor bottlenecks');
    process.exit(0);
  } else {
    console.log('\n✅ SUCCESS: Optimizations successful! Application handles load well');
    process.exit(0);
  }
};

main().catch(console.error); 