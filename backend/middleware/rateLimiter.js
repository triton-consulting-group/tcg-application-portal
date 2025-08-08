const rateLimit = require('express-rate-limit');
const scalingConfig = require('../config/scalingConfig');

// Rate limiter for application submissions (scaled for 300+ applications)
const applicationSubmissionLimiter = rateLimit({
  windowMs: scalingConfig.rateLimits.applicationSubmission.windowMs,
  max: scalingConfig.rateLimits.applicationSubmission.max, // 500 requests per 15 minutes
  message: {
    error: 'Too many application submissions from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Rate limiter for general API requests (scaled for 300+ applications)
const generalApiLimiter = rateLimit({
  windowMs: scalingConfig.rateLimits.generalApi.windowMs,
  max: scalingConfig.rateLimits.generalApi.max, // 3000 requests per 15 minutes
  message: {
    error: 'Too many requests from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Rate limiter for admin operations (scaled for 300+ applications)
const adminLimiter = rateLimit({
  windowMs: scalingConfig.rateLimits.adminOperations.windowMs,
  max: scalingConfig.rateLimits.adminOperations.max, // 1000 requests per 15 minutes
  message: {
    error: 'Too many admin operations from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Admin rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

module.exports = {
  applicationSubmissionLimiter,
  generalApiLimiter,
  adminLimiter
}; 