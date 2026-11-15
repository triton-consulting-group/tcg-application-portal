const { decodeUploadName, safeFileName, uploadMetadata } = require("../utils/uploadFilename");

const asMulterSees = (name) => Buffer.from(name, "utf8").toString("latin1");

describe("decodeUploadName", () => {
  test("leaves ASCII unchanged", () => {
    expect(decodeUploadName("resume.pdf")).toBe("resume.pdf");
    expect(decodeUploadName("My Resume (1).pdf")).toBe("My Resume (1).pdf");
  });

  test.each(["résumé.pdf", "Hồ sơ.pdf", "簡歷.pdf", "简历.pdf", "photo 😀.png"])(
    "recovers %s from the latin1 form multer produces",
    (name) => {
      expect(decodeUploadName(asMulterSees(name))).toBe(name.normalize("NFC"));
    }
  );

  test("recovers an NFD (macOS) name as NFC", () => {
    const nfd = "résumé.pdf";
    expect(decodeUploadName(asMulterSees(nfd))).toBe("résumé.pdf");
    expect(decodeUploadName(nfd)).toBe("résumé.pdf");
  });

  test.each(["résumé.pdf", "简历.pdf", "photo 😀.png"])("does not alter already-correct UTF-8 %s", (name) => {
    expect(decodeUploadName(name)).toBe(name);
  });

  test("returns an empty string for falsy input", () => {
    expect(decodeUploadName("")).toBe("");
    expect(decodeUploadName(undefined)).toBe("");
    expect(decodeUploadName(null)).toBe("");
  });
});

describe("safeFileName", () => {
  test("keeps clean names", () => {
    expect(safeFileName("resume.pdf", "file")).toBe("resume.pdf");
  });

  test("strips accents and replaces spaces", () => {
    expect(safeFileName("résumé.pdf", "file")).toBe("resume.pdf");
    expect(safeFileName("résumé.pdf", "file")).toBe("resume.pdf");
    expect(safeFileName("Hồ sơ.pdf", "file")).toBe("Ho_so.pdf");
  });

  test("uses the fallback when nothing ASCII is left", () => {
    expect(safeFileName("简历.pdf", "file_resume")).toBe("file_resume.pdf");
    expect(safeFileName("!!!???.pdf", "fb")).toBe("fb.pdf");
    expect(safeFileName("", "fb")).toBe("fb");
    expect(safeFileName(undefined, "fb")).toBe("fb");
  });

  test("collapses and trims separators", () => {
    expect(safeFileName("My Resume (1).pdf", "file")).toBe("My_Resume_1.pdf");
  });

  test("truncates long names to 100 characters before the extension", () => {
    expect(safeFileName(`${"a".repeat(300)}.pdf`, "file")).toBe(`${"a".repeat(100)}.pdf`);
  });

  test("handles odd extensions", () => {
    expect(safeFileName("report.", "file")).toBe("report");
    expect(safeFileName("report.???", "file")).toBe("report");
    expect(safeFileName("noext", "file")).toBe("noext");
    expect(safeFileName("a.p df", "file")).toBe("a.p_df");
    expect(safeFileName(`a.${"x".repeat(300)}`, "file")).toBe(`a.${"x".repeat(15)}`);
  });

  test("always returns only safe characters", () => {
    for (const n of ["résumé.pdf", "简历.pdf", "😀.png", "a/b\\c.pdf", "..hidden", "x y\tz.docx"]) {
      expect(safeFileName(n, "file")).toMatch(/^[A-Za-z0-9._-]+$/);
    }
  });
});

describe("uploadMetadata", () => {
  const now = new Date("2026-01-02T03:04:05.000Z");

  test.each(["resume.pdf", "résumé.pdf", "Hồ sơ.pdf", "简历.pdf", "photo 😀.png"])(
    "produces printable ASCII values that round-trip %s",
    (name) => {
      const meta = uploadMetadata({ fieldname: "resume", originalname: asMulterSees(name) }, now);
      for (const value of Object.values(meta)) expect(value).toMatch(/^[\x20-\x7E]*$/);
      expect(decodeURIComponent(meta.originalName)).toBe(name.normalize("NFC"));
      expect(meta.fieldName).toBe("resume");
      expect(meta.uploadedAt).toBe("2026-01-02T03:04:05.000Z");
    }
  );
});
