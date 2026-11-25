// Uses the existing loadtest dependency; no production services or credentials.
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const { spawn } = require("child_process");
const path = require("path");

async function main() {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  try {
    const code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [
        require.resolve("../backend/node_modules/jest/bin/jest"),
        "--runInBand", "--testTimeout=30000", "adminManagementConcurrency.test.js"
      ], {
        cwd: path.join(__dirname, "../backend"),
        env: { ...process.env, ADMIN_TEST_MONGO_URI: replica.getUri() },
        stdio: "inherit",
        windowsHide: true
      });
      child.on("error", reject);
      child.on("exit", code => resolve(code ?? 1));
    });
    process.exitCode = code;
  } finally {
    await replica.stop();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
