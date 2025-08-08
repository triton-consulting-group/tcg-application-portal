// Scaling configuration for 300+ applications
const scalingConfig = {
  // Rate limiting adjustments for higher volume
  rateLimits: {
    applicationSubmission: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 500, // Increased from 100 to 500 (33.3 submissions/minute)
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    },
    generalApi: {
      windowMs: 15 * 60 * 1000,
      max: 3000, // Increased from 1000 to 3000
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    },
    adminOperations: {
      windowMs: 15 * 60 * 1000,
      max: 1000, // Increased from 500 to 1000
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    }
  },

  // Database optimization settings
  database: {
    maxPoolSize: 100, // Increased from 50
    minPoolSize: 10,  // Increased from 5
    maxIdleTimeMS: 60000, // Increased idle time
    serverSelectionTimeoutMS: 10000, // Increased timeout
    socketTimeoutMS: 60000, // Increased socket timeout
    bufferCommands: false,
    // Pagination settings
    defaultPageSize: 50,
    maxPageSize: 200
  },

  // Application performance settings
  performance: {
    maxConcurrentRequests: 50, // Increased concurrent handling
    requestTimeout: 30000, // 30 seconds
    fileUploadLimit: '10mb',
    jsonBodyLimit: '10mb'
  },

  // Caching settings (for future Redis implementation)
  caching: {
    enabled: false, // Will be enabled when Redis is added
    ttl: 300, // 5 minutes
    maxKeys: 1000
  }
};

module.exports = scalingConfig; 