const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const SQLITE_FILE = process.env.SQLITE_FILE || path.join(DATA_DIR, "expo_sales.db");
const SQLITE_HELPER = path.join(ROOT, "sqlite_store.py");
const MYSQL_HELPER = path.join(ROOT, "mysql_store.py");
const BUNDLED_PYTHON_BIN = path.join(
  process.env.USERPROFILE || "",
  ".cache",
  "codex-runtimes",
  "codex-primary-runtime",
  "dependencies",
  "python",
  "python.exe"
);
const PYTHON_BIN = process.env.PYTHON_BIN || (require("fs").existsSync(BUNDLED_PYTHON_BIN) ? BUNDLED_PYTHON_BIN : (process.platform === "win32" ? "python" : "python3"));
function run(command, args, input = "", label = "command") {
  const result = spawnSync(command, args, {
    input,
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    maxBuffer: 1024 * 1024 * 80
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `${label} failed`).trim());
  }
  return result.stdout || "";
}

function countOf(db, key) {
  return Array.isArray(db[key]) ? db[key].length : 0;
}

function main() {
  const raw = run(PYTHON_BIN, [SQLITE_HELPER, SQLITE_FILE, "read"], "", "SQLite read").trim();
  if (!raw) throw new Error(`SQLite 中没有可迁移数据：${SQLITE_FILE}`);

  const existing = run(PYTHON_BIN, [MYSQL_HELPER, "read"], "", "MySQL read").trim();
  if (existing && process.env.MIGRATE_OVERWRITE !== "1") {
    throw new Error("MySQL 已存在数据。确认覆盖请设置 MIGRATE_OVERWRITE=1 后重新执行");
  }

  const db = JSON.parse(raw);
  run(PYTHON_BIN, [MYSQL_HELPER, "write"], raw, "MySQL write");

  const summary = {
    events: db.settings?.events?.length || 0,
    users: countOf(db, "users"),
    booths: countOf(db, "booths"),
    orders: countOf(db, "orders"),
    customerLeads: countOf(db, "customerLeads"),
    companies: countOf(db, "companies"),
    attachments: countOf(db, "attachments")
  };
  process.stdout.write(`SQLite 数据已迁移到 MySQL：${JSON.stringify(summary)}`);
}

try {
  main();
} catch (error) {
  process.stderr.write(error.message || String(error));
  process.exit(1);
}
