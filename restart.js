#!/usr/bin/env node

/**
 * Elideable Development Restart Script
 * Cross-platform script to kill and restart both backend and frontend services
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const os = require('os');

const isWindows = os.platform() === 'win32';

console.log('🔄 Restarting Elideable services...');

// Kill processes on specific ports
async function killPort(port, serviceName) {
  return new Promise((resolve) => {
    console.log(`   Killing processes on port ${port} (${serviceName})...`);
    
    if (isWindows) {
      // Windows: Use netstat and taskkill
      exec(`for /f "tokens=5" %a in ('netstat -aon ^| find ":${port}"') do taskkill /f /pid %a`, 
        { shell: true }, (error) => {
          if (error && !error.message.includes('not found')) {
            console.log(`   No process found on port ${port}`);
          }
          resolve();
        });
    } else {
      // Unix/Linux/Mac: Use lsof and kill
      exec(`lsof -ti:${port} | xargs kill -9`, (error) => {
        if (error) {
          console.log(`   No process found on port ${port}`);
        }
        resolve();
      });
    }
  });
}

// Kill processes by name pattern
async function killByName(pattern, description) {
  return new Promise((resolve) => {
    console.log(`   Killing ${description}...`);
    
    if (isWindows) {
      exec(`taskkill /f /im node.exe`, (error) => {
        resolve();
      });
    } else {
      exec(`pkill -f "${pattern}"`, (error) => {
        resolve();
      });
    }
  });
}

// Start a service
function startService(command, args, cwd, title) {
  return new Promise((resolve, reject) => {
    console.log(`🚀 Starting ${title}...`);

    const fullCommand = `${command} ${args.join(' ')}`;
    const options = {
      cwd: path.join(__dirname, cwd),
      shell: true,
      detached: true,
      stdio: 'ignore'
    };

    if (isWindows) {
      // On Windows, start in new command window
      spawn('cmd', ['/c', 'start', `"${title}"`, 'cmd', '/k', fullCommand], options);
    } else {
      // On Unix systems, start in background
      spawn('sh', ['-c', `${fullCommand} &`], options);
    }

    console.log(`   ${title} started`);
    resolve();
  });
}

// Wait function
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main restart function
async function restart() {
  try {
    // Kill existing processes
    console.log('🛑 Stopping existing services...');
    
    await killPort(8787, 'Elide backend');
    await killPort(5173, 'Vite frontend');
    await killByName('elide.mjs', 'Node.js processes');
    
    console.log('   Waiting for processes to terminate...');
    await wait(2000);
    
    // Start backend
    await startService('node', ['--env-file=../../.env', 'elide.mjs'], 'services/elide', 'Elide Backend');
    await wait(3000); // Wait for backend to initialize
    
    // Start frontend
    await startService('pnpm', ['dev'], 'apps/web', 'Vite Frontend');
    await wait(3000); // Wait for frontend to start
    
    console.log('');
    console.log('✅ Services restarted successfully!');
    console.log('   🔗 Frontend: http://localhost:5173');
    console.log('   🔗 Backend:  http://localhost:8787');
    console.log('');
    
    if (isWindows) {
      console.log('💡 Two new command windows opened with service logs');
      console.log('🛑 To stop services: Close the command windows or use Ctrl+C');
    } else {
      console.log('💡 Services running in background');
      console.log('🛑 To stop services: Use the kill commands or restart script again');
    }
    
  } catch (error) {
    console.error('❌ Error during restart:', error.message);
    process.exit(1);
  }
}

// Run the restart
restart();
