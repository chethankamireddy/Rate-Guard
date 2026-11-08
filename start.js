#!/usr/bin/env node

/**
 * RateGuard Combined Launcher
 * Boots C++ Engine, Node.js API Gateway, and serves the Frontend Dashboard in a single process tree.
 */

import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(`
\x1b[35m====================================================================\x1b[0m
\x1b[1m\x1b[36m   RateGuard — Combined Engine, Backend & Frontend Launcher\x1b[0m
\x1b[35m====================================================================\x1b[0m
`);

// 1. Verify C++ Engine binary
const cppDir = path.join(__dirname, 'rate-limiter');
const cppBinary = path.join(cppDir, process.platform === 'win32' ? 'engine.exe' : 'engine');

if (!fs.existsSync(cppBinary)) {
  console.log('\x1b[33m[1/3] C++ Engine binary not found. Compiling...\x1b[0m');
  try {
    const compiler = process.platform === 'win32' && fs.existsSync('C:\\MinGW\\bin\\g++.exe')
      ? 'C:\\MinGW\\bin\\g++.exe'
      : 'g++';
    execSync(`"${compiler}" -std=c++11 -O2 src/engine.cpp -o engine.exe -lws2_32`, {
      cwd: cppDir,
      stdio: 'inherit',
    });
    console.log('\x1b[32m[+] C++ Engine compiled successfully.\x1b[0m');
  } catch (err) {
    console.warn('\x1b[31m[!] C++ compilation skipped. Local fallback engine will be used.\x1b[0m');
  }
} else {
  console.log('\x1b[32m[1/3] C++ Rate-Limiting Engine binary verified.\x1b[0m');
}

// 2. Verify Frontend Dist
const frontendDist = path.join(__dirname, 'frontend', 'dist', 'index.html');
if (!fs.existsSync(frontendDist)) {
  console.log('\x1b[33m[2/3] Building frontend dashboard assets...\x1b[0m');
  execSync('npm run build', { cwd: path.join(__dirname, 'frontend'), stdio: 'inherit' });
  console.log('\x1b[32m[+] Frontend build ready.\x1b[0m');
} else {
  console.log('\x1b[32m[2/3] Frontend dashboard assets verified.\x1b[0m');
}

// 3. Start C++ Engine Process
console.log('\x1b[36m[3/3] Starting C++ Rate Limiter on port 7070...\x1b[0m');
let cppProcess = null;
if (fs.existsSync(cppBinary)) {
  try {
    cppProcess = spawn(cppBinary, ['7070'], {
      cwd: cppDir,
      stdio: 'pipe',
    });

    cppProcess.stdout.on('data', (d) => {
      const line = d.toString().trim();
      if (line) console.log(`\x1b[34m[C++ Engine]\x1b[0m ${line}`);
    });
    cppProcess.stderr.on('data', (d) => {
      console.error(`\x1b[31m[C++ Engine Error]\x1b[0m ${d.toString().trim()}`);
    });
  } catch (err) {
    console.warn('[!] Could not spawn standalone C++ engine:', err.message);
  }
}

// 4. Start Unified Backend (serves API + Frontend + WebSockets)
console.log('\x1b[36m[+] Starting Unified Gateway on port 4001...\x1b[0m');
const backendProcess = spawn('node', ['dist/index.js'], {
  cwd: path.join(__dirname, 'backend'),
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: '4001',
    CPP_ENGINE_URL: 'http://127.0.0.1:7070',
  },
});

// Graceful termination
const shutdown = () => {
  console.log('\n\x1b[33mStopping RateGuard services...\x1b[0m');
  if (cppProcess) {
    try { cppProcess.kill(); } catch {}
  }
  if (backendProcess) {
    try { backendProcess.kill(); } catch {}
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', shutdown);
