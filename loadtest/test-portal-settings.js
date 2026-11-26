const { MongoMemoryServer } = require("mongodb-memory-server");
const { spawn } = require("child_process");
const path = require("path");

async function main() {
  const mongo = await MongoMemoryServer.create();
  try {
    process.exitCode = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [require.resolve("../backend/node_modules/jest/bin/jest"), "--runInBand", "--testTimeout=30000", "portalSettings.integration.test.js"], {
        cwd: path.join(__dirname, "../backend"),
        env: { ...process.env, PORTAL_SETTINGS_TEST_URI: mongo.getUri() },
        stdio: "inherit", windowsHide: true
      });
      child.on("error", reject); child.on("exit", code => resolve(code ?? 1));
    });
  } finally { await mongo.stop(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
