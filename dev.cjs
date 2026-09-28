const { spawn, execSync } = require("child_process");
const path = require("path");

const rootDir = __dirname;
const isWindows = process.platform === "win32";

// ANSI Colors for high-contrast legible logging
const CYAN = "\x1b[36m\x1b[1m";
const MAGENTA = "\x1b[35m\x1b[1m";
const RESET = "\x1b[0m";
const RED = "\x1b[31m\x1b[1m";
const GREEN = "\x1b[32m\x1b[1m";

console.log(`${GREEN}====================================================${RESET}`);
console.log(`${GREEN} 🚀 VELOCITY RETAIL: RUNNING FRONTEND & BACKEND     ${RESET}`);
console.log(`${GREEN}====================================================${RESET}`);
console.log(`${CYAN}[BACKEND]${RESET}  Targeting: http://localhost:5000`);
console.log(`${MAGENTA}[FRONTEND]${RESET} Targeting: http://localhost:5173\n`);

// Automatically free port 5000 if occupied by an orphaned node process
if (isWindows) {
  try {
    execSync(
      'powershell -Command "Get-Process -Id (Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force"',
      { stdio: "ignore" }
    );
  } catch (e) {}
}

const spawnNpm = (args, cwd) => {
  if (isWindows) {
    return spawn("cmd.exe", ["/d", "/s", "/c", "npm", ...args], {
      cwd,
      stdio: ["inherit", "pipe", "pipe"],
    });
  } else {
    return spawn("npm", args, {
      cwd,
      stdio: ["inherit", "pipe", "pipe"],
    });
  }
};

// Spawn Backend
const backend = spawnNpm(["run", "dev"], path.join(rootDir, "backend"));

// Spawn Frontend
const frontend = spawnNpm(["run", "dev"], path.join(rootDir, "frontend"));

const pipeOutput = (child, prefix, color) => {
  const lineBuffer = (data, isErr) => {
    const lines = data.toString().split(/\r?\n/);
    lines.forEach((line) => {
      if (line.trim()) {
        const stream = isErr ? process.stderr : process.stdout;
        stream.write(`${color}[${prefix}]${RESET} ${line}\n`);
      }
    });
  };

  child.stdout.on("data", (d) => lineBuffer(d, false));
  child.stderr.on("data", (d) => lineBuffer(d, true));
};

pipeOutput(backend, "BACKEND", CYAN);
pipeOutput(frontend, "FRONTEND", MAGENTA);

let cleanedUp = false;
const cleanup = () => {
  if (cleanedUp) return;
  cleanedUp = true;
  console.log(`\n${RED}🛑 Stopping Velocity Retail services...${RESET}`);
  if (isWindows) {
    if (backend.pid) {
      try {
        execSync(`taskkill /pid ${backend.pid} /T /F`, { stdio: "ignore" });
      } catch (e) {}
    }
    if (frontend.pid) {
      try {
        execSync(`taskkill /pid ${frontend.pid} /T /F`, { stdio: "ignore" });
      } catch (e) {}
    }
  } else {
    backend.kill();
    frontend.kill();
  }
  process.exit();
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);

backend.on("close", (code) => {
  if (code !== 0 && code !== null && !cleanedUp) {
    console.log(`${RED}[BACKEND] Process exited with code ${code}${RESET}`);
  }
});

frontend.on("close", (code) => {
  if (code !== 0 && code !== null && !cleanedUp) {
    console.log(`${RED}[FRONTEND] Process exited with code ${code}${RESET}`);
  }
});
