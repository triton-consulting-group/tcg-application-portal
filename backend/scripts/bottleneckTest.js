const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Bottleneck Test Configuration
const CONFIG = {
  BASE_URL: 'http://localhost:5002/api',
  TARGET_APPLICATIONS: 100,
  CONCURRENT_BATCHES: [1, 5, 10, 20, 50], // Test different concurrency levels
  TEST_DURATION: 60000, // 1 minute stress test
  REQUEST_TIMEOUT: 15000, // 15 seconds
  DATABASE_OPERATIONS: ['CREATE', 'READ', 'UPDATE', 'DELETE']
};

// Test data generator
const generateApplication = (index) => ({
  email: `bottleneck-test-${index}@example.com`,
  fullName: `Bottleneck Test User ${index}`,
  studentYear: ['Freshman', 'Sophomore', 'Junior', 'Senior'][index % 4],
  major: ['Computer Science', 'Business', 'Engineering', 'Arts'][index % 4],
  appliedBefore: index % 2 === 0 ? 'Yes' : 'No',
  candidateType: ['Full-time', 'Part-time', 'Intern'][index % 3],
  reason: `Bottleneck test application ${index} - Testing system performance under load.`
});

// Performance monitoring
class BottleneckAnalyzer {
  constructor() {
    this.metrics = {
      requests: [],
      bottlenecks: [],
      databaseOperations: [],
      memoryUsage: [],
      responseTimes: []
    };
    this.startTime = Date.now();
  }

  recordRequest(operation, duration, success, error = null) {
    const metric = {
      operation,
      duration,
      success,
      error,
      timestamp: Date.now(),
      memoryUsage: process.memoryUsage()
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

    if (duration > 5000) { // 5 second threshold
      this.metrics.bottlenecks.push({
        type: 'slow_response',
        operation,
        duration,
        timestamp: Date.now()
      });
    }
  }

  recordDatabaseOperation(operation, duration, success) {
    this.metrics.databaseOperations.push({
      operation,
      duration,
      success,
      timestamp: Date.now()
    });
  }

  analyzeBottlenecks() {
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

    // Generate recommendations based on bottlenecks
    if (analysis.successRate < 95) {
      analysis.recommendations.push('Implement request queuing and retry mechanisms');
    }
    if (analysis.averageResponseTime > 2000) {
      analysis.recommendations.push('Optimize database queries and add indexing');
    }
    if (this.metrics.bottlenecks.some(b => b.type === 'slow_response')) {
      analysis.recommendations.push('Consider implementing caching for frequently accessed data');
    }

    return analysis;
  }

  generateReport() {
    const analysis = this.analyzeBottlenecks();
    const totalTime = Date.now() - this.startTime;
    const requestsPerSecond = analysis.totalRequests / (totalTime / 1000);

    const report = `
🔍 BOTTLENECK ANALYSIS REPORT
============================
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
  analysis.bottlenecks.map(b => `- ${b.type}: ${b.operation} (${b.duration || 'N/A'}ms)`).join('\n') : 
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

${analysis.successRate >= 95 && analysis.averageResponseTime < 2000 ? 
  '🎉 EXCELLENT: Application can handle 100+ applications efficiently!' :
  analysis.successRate >= 80 ? 
  '⚠️  GOOD: Minor optimizations recommended' :
  '🚨 CRITICAL: Significant performance issues detected'}
`;

    console.log(report);
    return report;
  }
}

// HTTP request helper with detailed error handling
const makeRequest = async (method, endpoint, data = null) => {
  const startTime = Date.now();
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
      data: response.data
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      duration,
      statusCode: error.response?.status || 0,
      error: {
        message: error.message,
        code: error.code,
        response: error.response?.data
      }
    };
  }
};

// Test scenarios
const testApplicationCreation = async (analyzer, batchSize) => {
  console.log(`\n📝 Testing Application Creation (Batch Size: ${batchSize})`);
  
  const applications = Array.from({ length: CONFIG.TARGET_APPLICATIONS }, (_, i) => 
    generateApplication(i + 1)
  );

  for (let i = 0; i < applications.length; i += batchSize) {
    const batch = applications.slice(i, i + batchSize);
    const promises = batch.map(app => makeRequest('POST', '/applications', app));
    
    const results = await Promise.all(promises);
    
    results.forEach((result, index) => {
      analyzer.recordRequest('CREATE_APPLICATION', result.duration, result.success, result.error);
      analyzer.recordDatabaseOperation('INSERT', result.duration, result.success);
    });

    console.log(`Created batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(applications.length / batchSize)}`);
    
    // Small delay to prevent overwhelming
    if (i + batchSize < applications.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
};

const testApplicationRetrieval = async (analyzer) => {
  console.log('\n📋 Testing Application Retrieval');
  
  // Test bulk retrieval
  const bulkResult = await makeRequest('GET', '/applications');
  analyzer.recordRequest('GET_ALL_APPLICATIONS', bulkResult.duration, bulkResult.success, bulkResult.error);
  analyzer.recordDatabaseOperation('SELECT_ALL', bulkResult.duration, bulkResult.success);
  
  // Test individual retrievals
  const individualPromises = Array.from({ length: 20 }, (_, i) => 
    makeRequest('GET', `/applications/email/bottleneck-test-${i + 1}@example.com`)
  );
  
  const individualResults = await Promise.all(individualPromises);
  individualResults.forEach(result => {
    analyzer.recordRequest('GET_APPLICATION_BY_EMAIL', result.duration, result.success, result.error);
    analyzer.recordDatabaseOperation('SELECT_ONE', result.duration, result.success);
  });
};

const testConcurrentLoad = async (analyzer) => {
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
      analyzer.recordRequest(`CONCURRENT_CREATE_${concurrency}`, result.duration, result.success, result.error);
    });
    
    console.log(`Batch completed in ${batchDuration}ms (${concurrency} requests)`);
    
    // Delay between concurrency tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
};

const testStressScenario = async (analyzer) => {
  console.log('\n🔥 Running Stress Test');
  
  const startTime = Date.now();
  const requests = [];
  
  while (Date.now() - startTime < CONFIG.TEST_DURATION) {
    // Mix of operations
    const operation = Math.random();
    if (operation < 0.6) {
      // 60% create operations
      const app = generateApplication(Math.floor(Math.random() * 10000));
      requests.push(makeRequest('POST', '/applications', app));
    } else if (operation < 0.8) {
      // 20% read operations
      requests.push(makeRequest('GET', '/applications'));
    } else {
      // 20% individual read operations
      const email = `bottleneck-test-${Math.floor(Math.random() * 100)}@example.com`;
      requests.push(makeRequest('GET', `/applications/email/${email}`));
    }
    
    // Process in batches
    if (requests.length >= 10) {
      const batch = requests.splice(0, 10);
      const results = await Promise.all(batch);
      
      results.forEach(result => {
        analyzer.recordRequest('STRESS_TEST', result.duration, result.success, result.error);
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Process remaining requests
  if (requests.length > 0) {
    const results = await Promise.all(requests);
    results.forEach(result => {
      analyzer.recordRequest('STRESS_TEST', result.duration, result.success, result.error);
    });
  }
};

// Main bottleneck test runner
const runBottleneckTest = async () => {
  console.log('🔍 Starting Bottleneck Analysis for TCG Application Portal');
  console.log(`🎯 Target: ${CONFIG.TARGET_APPLICATIONS} applications`);
  console.log(`⚡ Concurrency levels: ${CONFIG.CONCURRENT_BATCHES.join(', ')}`);
  console.log(`⏱️  Stress test duration: ${CONFIG.TEST_DURATION / 1000}s`);
  console.log('=' .repeat(60));
  
  const analyzer = new BottleneckAnalyzer();
  
  try {
    // Test 1: Sequential application creation
    await testApplicationCreation(analyzer, 5);
    
    // Test 2: Application retrieval
    await testApplicationRetrieval(analyzer);
    
    // Test 3: Concurrent load testing
    await testConcurrentLoad(analyzer);
    
    // Test 4: Stress testing
    await testStressScenario(analyzer);
    
  } catch (error) {
    console.error('❌ Bottleneck test failed:', error.message);
    analyzer.recordRequest('TEST_ERROR', 0, false, error);
  }
  
  // Generate analysis report
  console.log('\n' + '='.repeat(60));
  const report = analyzer.generateReport();
  
  // Save detailed report
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(__dirname, `bottleneck-analysis-${timestamp}.txt`);
  fs.writeFileSync(reportPath, report);
  console.log(`📄 Detailed report saved to: ${reportPath}`);
  
  // Save raw metrics for further analysis
  const metricsPath = path.join(__dirname, `bottleneck-metrics-${timestamp}.json`);
  fs.writeFileSync(metricsPath, JSON.stringify(analyzer.metrics, null, 2));
  console.log(`📊 Raw metrics saved to: ${metricsPath}`);
  
  return analyzer.analyzeBottlenecks();
};

// Check server availability
const checkServer = async () => {
  try {
    await axios.get(`${CONFIG.BASE_URL.replace('/api', '')}/`, { 
      timeout: 5000 
    });
    console.log('✅ Server is running and accessible');
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
  
  const results = await runBottleneckTest();
  
  // Exit with appropriate code based on results
  if (results.successRate < 80) {
    console.log('\n🚨 CRITICAL: Application has significant bottlenecks');
    process.exit(1);
  } else if (results.successRate < 95) {
    console.log('\n⚠️  WARNING: Application has minor bottlenecks');
    process.exit(0);
  } else {
    console.log('\n✅ SUCCESS: Application handles load well');
    process.exit(0);
  }
};

main().catch(console.error); 