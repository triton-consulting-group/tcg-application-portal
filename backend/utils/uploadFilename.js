const path = require("path");

// multer 1.x decodes multipart filenames as latin1, so UTF-8 names arrive as mojibake.
const decodeUploadName = (raw) => {
  if (!raw) return "";
  let result = raw;
  let allLatin1 = true;
  for (let i = 0; i < raw.length; i++) {
    if (raw.charCodeAt(i) > 0xff) {
      allLatin1 = false;
      break;
    }
  }
  if (allLatin1) {
    const bytes = Buffer.from(raw, "latin1");
    const decoded = bytes.toString("utf8");
    if (!decoded.includes("�") && Buffer.from(decoded, "utf8").equals(bytes)) {
      result = decoded;
    }
  }
  return result.normalize("NFC");
};

const cleanChars = (s) =>
  s.replace(/[^A-Za-z0-9._-]/g, "_").replace(/_{2,}/g, "_");

const safeFileName = (name, fallback) => {
  const input = name || "";
  const rawExt = path.extname(input);
  const rawBase = rawExt ? input.slice(0, -rawExt.length) : input;

  let base = cleanChars(rawBase.normalize("NFD").replace(/\p{M}/gu, ""))
    .replace(/^[_.]+|[_.]+$/g, "")
    .slice(0, 100)
    .replace(/^[_.]+|[_.]+$/g, "");
  if (!base) base = fallback;

  let ext = cleanChars(rawExt.normalize("NFD").replace(/\p{M}/gu, "")).slice(0, 16);
  if (/^\.?[_.]*$/.test(ext)) ext = "";

  return base + ext;
};

const uploadMetadata = (file, now = new Date()) => ({
  fieldName: file.fieldname,
  originalName: encodeURIComponent(decodeUploadName(file.originalname)),
  uploadedAt: now.toISOString(),
});

module.exports = { decodeUploadName, safeFileName, uploadMetadata };
