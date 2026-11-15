process.env.AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE = "1";

const http = require("http");
const express = require("express");
const multer = require("multer");
const multerS3 = require("multer-s3");
const AWS = require("aws-sdk");
const { decodeUploadName, safeFileName, uploadMetadata } = require("../utils/uploadFilename");

const CREDS = new AWS.Credentials("AKIDEXAMPLE", "secret");

let fakeS3;
let fakePort;
let appServer;
let appBase;
let seen;

// Fake S3 that verifies SigV4 from the bytes it actually received, as S3 does.
const handleS3 = (req, res) => {
  const raw = req.rawHeaders;
  const got = {};
  for (let i = 0; i < raw.length; i += 2) {
    got[raw[i].toLowerCase()] = Buffer.from(raw[i + 1], "latin1").toString("utf8");
  }
  const auth = got.authorization;
  const signed = /SignedHeaders=([^,]+)/.exec(auth)[1].split(";");
  const hr = new AWS.HttpRequest(new AWS.Endpoint(`http://127.0.0.1:${fakePort}`), "us-west-1");
  hr.method = req.method;
  hr.path = req.url;
  hr.headers = {};
  for (const h of signed) {
    if (h !== "x-amz-date" && h !== "x-amz-content-sha256") hr.headers[h] = got[h];
  }
  hr.headers["X-Amz-Content-Sha256"] = got["x-amz-content-sha256"];
  const amzDate = got["x-amz-date"];
  const date = new Date(amzDate.replace(/(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z/, "$1-$2-$3T$4:$5:$6Z"));
  new AWS.Signers.V4(hr, "s3", { signatureCache: false }).addAuthorization(CREDS, date);
  const valid = hr.headers.Authorization === auth;
  seen = { valid, path: req.url, meta: got["x-amz-meta-originalname"] };
  req.resume();
  req.on("end", () => {
    if (valid) {
      res.setHeader("ETag", '"x"');
      res.end();
    } else {
      res.statusCode = 403;
      res.end('<?xml version="1.0"?><Error><Code>SignatureDoesNotMatch</Code><Message>sig</Message></Error>');
    }
  });
};

const buildApp = (metadata) => {
  const s3 = new AWS.S3({
    endpoint: `http://127.0.0.1:${fakePort}`,
    s3ForcePathStyle: true,
    credentials: CREDS,
    region: "us-west-1",
    signatureVersion: "v4",
    maxRetries: 0
  });
  const upload = multer({
    storage: multerS3({
      s3,
      bucket: "bucket",
      key: (req, file, cb) => {
        cb(null, `resumes/${Date.now()}-${safeFileName(decodeUploadName(file.originalname), "file_resume")}`);
      },
      metadata
    })
  });
  const app = express();
  app.post("/", upload.single("resume"), (req, res) => res.json({ ok: true }));
  app.use((err, req, res, next) => res.status(500).json({ code: err.code || err.message }));
  return app;
};

const startApp = (metadata) =>
  new Promise((resolve) => {
    appServer = buildApp(metadata).listen(0, () => {
      appBase = `http://127.0.0.1:${appServer.address().port}/`;
      resolve();
    });
  });

const stopApp = () => new Promise((resolve) => (appServer ? appServer.close(resolve) : resolve()));

const postFile = (name) => {
  const fd = new FormData();
  fd.append("resume", new Blob(["%PDF-1.4"], { type: "application/pdf" }), name);
  return fetch(appBase, { method: "POST", body: fd });
};

beforeAll((done) => {
  fakeS3 = http.createServer(handleS3);
  fakeS3.listen(0, () => {
    fakePort = fakeS3.address().port;
    done();
  });
});

afterAll(async () => {
  await stopApp();
  await new Promise((resolve) => fakeS3.close(resolve));
});

beforeEach(() => {
  seen = null;
});

describe("S3 upload signing with the production metadata and key", () => {
  beforeAll(() => startApp((req, file, cb) => cb(null, uploadMetadata(file))));
  afterAll(stopApp);

  test.each([
    ["resume.pdf", "resume.pdf"],
    ["résumé.pdf", "résumé.pdf"],
    ["résumé.pdf", "résumé.pdf"],
    ["Hồ sơ.pdf", "Hồ sơ.pdf"],
    ["简历.pdf", "简历.pdf"]
  ])("uploads %j", async (name, expectedName) => {
    const res = await postFile(name);
    expect(res.status).toBe(200);
    expect(seen.valid).toBe(true);
    expect(seen.path).toMatch(/^[\x21-\x7E]+$/);
    expect(decodeURIComponent(seen.meta)).toBe(expectedName.normalize("NFC"));
  });
});

describe("harness control", () => {
  beforeAll(() => startApp((req, file, cb) => cb(null, { originalName: file.originalname })));
  afterAll(stopApp);

  test("raw originalname metadata for a non-ASCII name is rejected by the fake S3", async () => {
    const res = await postFile("résumé.pdf");
    expect(seen.valid).toBe(false);
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("SignatureDoesNotMatch");
  });
});
