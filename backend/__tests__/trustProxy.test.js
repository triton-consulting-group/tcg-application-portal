const express = require("express");
const rateLimit = require("express-rate-limit");
const { DEFAULT_TRUST_PROXY_HOPS, getTrustProxyHops } = require("../config/proxyConfig");
const { adminLimiter } = require("../middleware/rateLimiter");

const startTestApp = async (trustProxy, limiter) => {
  const app = express();
  app.set("trust proxy", trustProxy);
  app.use(limiter);
  app.get("/probe", (req, res) => {
    res.json({ ip: req.ip });
  });

  const server = await new Promise((resolve) => {
    const srv = app.listen(0, "127.0.0.1", () => resolve(srv));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    close: () => new Promise((resolve) => server.close(resolve))
  };
};

const hasPermissiveProxyError = (errorSpy) =>
  errorSpy.mock.calls.flat().some(
    (arg) =>
      arg?.code === "ERR_ERL_PERMISSIVE_TRUST_PROXY" ||
      String(arg).includes("ERR_ERL_PERMISSIVE_TRUST_PROXY")
  );

describe("getTrustProxyHops", () => {
  const originalTrustProxyHops = process.env.TRUST_PROXY_HOPS;

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalTrustProxyHops === undefined) {
      delete process.env.TRUST_PROXY_HOPS;
    } else {
      process.env.TRUST_PROXY_HOPS = originalTrustProxyHops;
    }
  });

  test("defaults to 1 hop when unset or blank", () => {
    delete process.env.TRUST_PROXY_HOPS;
    expect(DEFAULT_TRUST_PROXY_HOPS).toBe(1);
    expect(getTrustProxyHops()).toBe(1);
    expect(getTrustProxyHops(undefined)).toBe(1);
    expect(getTrustProxyHops(null)).toBe(1);
    expect(getTrustProxyHops("")).toBe(1);
    expect(getTrustProxyHops("   ")).toBe(1);
  });

  test("parses valid non-negative integer hop counts", () => {
    expect(getTrustProxyHops("0")).toBe(0);
    expect(getTrustProxyHops("1")).toBe(1);
    expect(getTrustProxyHops("2")).toBe(2);
    expect(getTrustProxyHops(" 3 ")).toBe(3);
  });

  test.each(["true", "false", "-1", "1.5", "abc", "99999999999999999999999"])(
    "rejects invalid value %p, warns, and falls back to 1",
    (badValue) => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const hops = getTrustProxyHops(badValue);
      expect(hops).toBe(1);
      expect(hops).not.toBe(true);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toMatch(/TRUST_PROXY_HOPS/);
    }
  );

  test("reads process.env.TRUST_PROXY_HOPS when called without arguments", () => {
    process.env.TRUST_PROXY_HOPS = "2";
    expect(getTrustProxyHops()).toBe(2);
  });
});

describe("Express trust proxy and express-rate-limit behavior", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("with 1 hop, rotating spoofed X-Forwarded-For prefixes cannot bypass IP rate limiting", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const limiter = rateLimit({ windowMs: 60_000, max: 2, standardHeaders: true, legacyHeaders: false });
    const { base, close } = await startTestApp(getTrustProxyHops(), limiter);

    try {
      const ips = [];
      const statuses = [];
      for (const spoofed of ["1.1.1.1", "2.2.2.2", "3.3.3.3"]) {
        const res = await fetch(`${base}/probe`, {
          headers: { "X-Forwarded-For": `${spoofed}, 203.0.113.10` }
        });
        statuses.push(res.status);
        if (res.status === 200) {
          ips.push((await res.json()).ip);
        }
      }

      expect(ips).toEqual(["203.0.113.10", "203.0.113.10"]);
      expect(statuses).toEqual([200, 200, 429]);
      expect(hasPermissiveProxyError(errorSpy)).toBe(false);
    } finally {
      await close();
    }
  });

  test("with 1 hop, different real clients behind the proxy receive separate buckets", async () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 1, standardHeaders: true, legacyHeaders: false });
    const { base, close } = await startTestApp(getTrustProxyHops(), limiter);

    try {
      const r1 = await fetch(`${base}/probe`, { headers: { "X-Forwarded-For": "1.1.1.1, 203.0.113.10" } });
      const b1 = await r1.json();
      const r2 = await fetch(`${base}/probe`, { headers: { "X-Forwarded-For": "1.1.1.1, 203.0.113.11" } });
      const b2 = await r2.json();
      const r3 = await fetch(`${base}/probe`, { headers: { "X-Forwarded-For": "9.9.9.9, 203.0.113.10" } });

      expect(r1.status).toBe(200);
      expect(b1.ip).toBe("203.0.113.10");
      expect(r2.status).toBe(200);
      expect(b2.ip).toBe("203.0.113.11");
      expect(r3.status).toBe(429);
    } finally {
      await close();
    }
  });

  test("adminLimiter runs cleanly without ERR_ERL_PERMISSIVE_TRUST_PROXY", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { base, close } = await startTestApp(getTrustProxyHops(), adminLimiter);

    try {
      const res = await fetch(`${base}/probe`, {
        headers: { "X-Forwarded-For": "1.1.1.1, 203.0.113.10" }
      });
      expect(res.status).toBe(200);
      expect((await res.json()).ip).toBe("203.0.113.10");
      expect(hasPermissiveProxyError(errorSpy)).toBe(false);
    } finally {
      await close();
    }
  });

  test("control: trust proxy = true allows X-Forwarded-For spoofing and triggers ERR_ERL_PERMISSIVE_TRUST_PROXY", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const limiter = rateLimit({ windowMs: 60_000, max: 2, standardHeaders: true, legacyHeaders: false });
    const { base, close } = await startTestApp(true, limiter);

    try {
      const ips = [];
      const statuses = [];
      for (const spoofed of ["1.1.1.1", "2.2.2.2", "3.3.3.3"]) {
        const res = await fetch(`${base}/probe`, {
          headers: { "X-Forwarded-For": `${spoofed}, 203.0.113.10` }
        });
        statuses.push(res.status);
        ips.push((await res.json()).ip);
      }

      expect(ips).toEqual(["1.1.1.1", "2.2.2.2", "3.3.3.3"]);
      expect(statuses).toEqual([200, 200, 200]);
      expect(hasPermissiveProxyError(errorSpy)).toBe(true);
    } finally {
      await close();
    }
  });

  test("with 0 hops, X-Forwarded-For is ignored and req.ip stays the socket address", async () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 5, standardHeaders: true, legacyHeaders: false });
    const { base, close } = await startTestApp(getTrustProxyHops("0"), limiter);

    try {
      const res = await fetch(`${base}/probe`, {
        headers: { "X-Forwarded-For": "203.0.113.10" }
      });
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(["127.0.0.1", "::ffff:127.0.0.1"]).toContain(body.ip);
      expect(body.ip).not.toBe("203.0.113.10");
    } finally {
      await close();
    }
  });
});

describe("server.js trust proxy wiring", () => {
  test("configures trust proxy to numeric 1 instead of boolean true", () => {
    const origNodeEnv = process.env.NODE_ENV;
    const origTrustProxyHops = process.env.TRUST_PROXY_HOPS;
    const sigtermBefore = new Set(process.listeners("SIGTERM"));
    const sigintBefore = new Set(process.listeners("SIGINT"));

    process.env.NODE_ENV = "production";
    delete process.env.TRUST_PROXY_HOPS;

    jest.spyOn(console, "log").mockImplementation(() => {});

    try {
      jest.isolateModules(() => {
        const isolatedExpress = require("express");
        const listenSpy = jest.spyOn(isolatedExpress.application, "listen").mockImplementation(() => ({}));

        jest.doMock("dotenv", () => ({ config: jest.fn() }));
        jest.doMock("../config/db", () => jest.fn());
        jest.doMock("../config/s3Config", () => ({ isS3Configured: () => false }));
        jest.doMock("../routes/auth", () => isolatedExpress.Router());
        jest.doMock("../routes/applications", () => isolatedExpress.Router());
        jest.doMock("../routes/admin", () => isolatedExpress.Router());
        jest.doMock("../routes/caseGroups", () => isolatedExpress.Router());

        const app = require("../server");
        expect(app.get("trust proxy")).toBe(1);
        expect(app.get("trust proxy")).not.toBe(true);
        expect(listenSpy).toHaveBeenCalledTimes(1);
      });
    } finally {
      if (origNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = origNodeEnv;
      }
      if (origTrustProxyHops === undefined) {
        delete process.env.TRUST_PROXY_HOPS;
      } else {
        process.env.TRUST_PROXY_HOPS = origTrustProxyHops;
      }
      for (const listener of process.listeners("SIGTERM")) {
        if (!sigtermBefore.has(listener)) process.removeListener("SIGTERM", listener);
      }
      for (const listener of process.listeners("SIGINT")) {
        if (!sigintBefore.has(listener)) process.removeListener("SIGINT", listener);
      }
      jest.restoreAllMocks();
    }
  });
});
