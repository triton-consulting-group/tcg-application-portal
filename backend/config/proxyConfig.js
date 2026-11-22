const DEFAULT_TRUST_PROXY_HOPS = 1;

/**
 * Parses the configured Express `trust proxy` hop count.
 * Railway sits one reverse-proxy hop in front of Express, so valid non-negative
 * integers (e.g., 0, 1, 2) are used directly and missing/invalid values fall back
 * to 1. Never returns boolean `true`, which lets clients spoof X-Forwarded-For.
 */
const getTrustProxyHops = (rawValue = process.env.TRUST_PROXY_HOPS) => {
  if (rawValue === undefined || rawValue === null) {
    return DEFAULT_TRUST_PROXY_HOPS;
  }

  const trimmed = String(rawValue).trim();
  if (!trimmed) {
    return DEFAULT_TRUST_PROXY_HOPS;
  }

  if (/^\d+$/.test(trimmed)) {
    const hops = Number(trimmed);
    if (Number.isSafeInteger(hops)) {
      return hops;
    }
  }

  console.warn(
    `Invalid TRUST_PROXY_HOPS value "${rawValue}"; falling back to ${DEFAULT_TRUST_PROXY_HOPS} hop.`
  );
  return DEFAULT_TRUST_PROXY_HOPS;
};

module.exports = {
  DEFAULT_TRUST_PROXY_HOPS,
  getTrustProxyHops
};
