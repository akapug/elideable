#!/usr/bin/env node

/**
 * Simple development server starter for Elideable
 * Kills existing processes and starts both services
 */

const { spawn, exec } = require('child_process');
const os = require('os');

const isWindows = os.platform() === 'win32';

console.log('🔄 Starting Elideable development servers...');

// Kill existing processes
console.log('🛑 Stopping existing services...');

function killProcesses() {
  return new Promise((resolve) => {
    if (isWindows) {
      // Kill Node.js processes on Windows
      exec('taskkill /f /im node.exe', () => {
        setTimeout(resolve, 1000);
      });
    } else {
      // Kill specific processes on Unix
      exec('pkill -f "elide.mjs" && pkill -f "vite.*5173"', () => {
        setTimeout(resolve, 1000);
      });
    }
  });
}

async function startServices() {
  await killProcesses();
  
  console.log('🚀 Starting backend (Elide)...');
  
  // Start backend
  const backend = spawn('node', ['--env-file=../../.env', 'elide.mjs'], {
    cwd: './services/elide',
    stdio: 'inherit',
    shell: true
  });

  // Wait a moment for backend to start
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('🎨 Starting frontend (Vite)...');
  
  // Start frontend
  const frontend = spawn('pnpm', ['dev'], {
    cwd: './apps/web',
    stdio: 'inherit',
    shell: true
  });

  console.log('');
  console.log('✅ Development servers started!');
  console.log('   🔗 Frontend: http://localhost:5173');
  console.log('   🔗 Backend:  http://localhost:8787');
  console.log('');
  console.log('Press Ctrl+C to stop both servers');

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down servers...');
    backend.kill();
    frontend.kill();
    process.exit(0);
  });
}

startServices().catch(console.error);
