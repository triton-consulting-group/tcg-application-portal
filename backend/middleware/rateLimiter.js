const rateLimit = require('express-rate-limit');
const scalingConfig = require('../config/scalingConfig');

// Rate limiter for application submissions, counted per signed-in account (not per IP), so many
// applicants on one shared network don't block each other and a spoofed X-Forwarded-For can't dodge it.
// Must run after requireSignedInApplicant, which sets req.applicantEmail.
const applicationSubmissionLimiter = rateLimit({
  windowMs: scalingConfig.rateLimits.applicationSubmission.windowMs,
  max: scalingConfig.rateLimits.applicationSubmission.max,
  keyGenerator: (req) => (req.applicantEmail ? `applicant:${req.applicantEmail}` : `ip:${req.ip}`),
  message: {
    error: 'Too many application submissions from this account, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: '❌ Too many submission attempts from this account. Please wait 15 minutes and try again.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Rate limiter for signed-in API requests, counted per verified user (not per IP), so a whole board
// reviewing on one network doesn't share one budget and a spoofed X-Forwarded-For can't dodge it.
// Must run after the route's sign-in check, which sets req.verifiedEmail.
const generalApiLimiter = rateLimit({
  windowMs: scalingConfig.rateLimits.generalApi.windowMs,
  max: scalingConfig.rateLimits.generalApi.max,
  keyGenerator: (req) => (req.verifiedEmail ? `user:${req.verifiedEmail.toLowerCase()}` : `ip:${req.ip}`),
  message: {
    error: 'Too many requests from this account, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: '❌ Too many requests from this account. Please wait a few minutes and try again.',
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