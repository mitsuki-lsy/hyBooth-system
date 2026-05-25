const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const MYSQL_HELPER = path.join(ROOT, "mysql_store.py");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(DATA_DIR, "mysql-app.env"));

const command = process.argv[2] || "init";
if (!["init", "read", "write"].includes(command)) {
  process.stderr.write("usage: node run_mysql_store.js <init|read|write>");
  process.exit(2);
}

const pythonBin = process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");
const result = spawnSync(pythonBin, [MYSQL_HELPER, command], {
  input: command === "write" ? fs.readFileSync(0, "utf8") : "",
  encoding: "utf8",
  env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  maxBuffer: 1024 * 1024 * 80
});

if (result.error) throw result.error;
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status || 0);
