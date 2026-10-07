// Generates the files each test submission uploads (sizes in KB can be overridden via env).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cfg = require("./lib/config");

const SIZES_KB = {
  "resume.pdf": Number(process.env.RESUME_KB || 300),
  "transcript.pdf": Number(process.env.TRANSCRIPT_KB || 500),
  "image.jpg": Number(process.env.IMAGE_KB || 200),
};

const make = (name, kb) => {
  const body = crypto.randomBytes(kb * 1024);
  const isPdf = name.endsWith(".pdf");
  const head = isPdf ? Buffer.from("%PDF-1.4\n") : Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const tail = isPdf ? Buffer.from("\n%%EOF\n") : Buffer.from([0xff, 0xd9]);
  fs.writeFileSync(path.join(cfg.FIXTURES_DIR, name), Buffer.concat([head, body, tail]));
};

module.exports = () => {
  fs.mkdirSync(cfg.FIXTURES_DIR, { recursive: true });
  for (const [name, kb] of Object.entries(SIZES_KB)) {
    const file = path.join(cfg.FIXTURES_DIR, name);
    if (!fs.existsSync(file) || Math.abs(fs.statSync(file).size / 1024 - kb) > 1) make(name, kb);
  }
  return SIZES_KB;
};

if (require.main === module) console.log("[fixtures]", module.exports());
