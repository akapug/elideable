#!/bin/bash

# Elideable Development Restart Script
# Kills and restarts both backend and frontend services

echo "🔄 Restarting Elideable services..."

# Kill existing processes
echo "🛑 Stopping existing services..."

# Kill processes on specific ports
echo "   Killing processes on port 8787 (Elide backend)..."
lsof -ti:8787 | xargs kill -9 2>/dev/null || echo "   No process found on port 8787"

echo "   Killing processes on port 5173 (Vite frontend)..."
lsof -ti:5173 | xargs kill -9 2>/dev/null || echo "   No process found on port 5173"

# Kill by process name patterns
echo "   Killing Node.js processes..."
pkill -f "elide.mjs" 2>/dev/null || echo "   No elide.mjs processes found"
pkill -f "vite.*5173" 2>/dev/null || echo "   No Vite processes found"

# Wait a moment for processes to fully terminate
sleep 2

# Start backend
echo "🚀 Starting Elide backend..."
cd services/elide
node --env-file=../../.env elide.mjs &
BACKEND_PID=$!
echo "   Backend started with PID: $BACKEND_PID"

# Wait for backend to initialize
sleep 3

# Start frontend
echo "🎨 Starting Vite frontend..."
cd ../../apps/web
pnpm dev &
FRONTEND_PID=$!
echo "   Frontend started with PID: $FRONTEND_PID"

# Wait for services to start
sleep 3

echo ""
echo "✅ Services restarted successfully!"
echo "   🔗 Frontend: http://localhost:5173"
echo "   🔗 Backend:  http://localhost:8787"
echo ""
echo "📋 Process IDs:"
echo "   Backend PID:  $BACKEND_PID"
echo "   Frontend PID: $FRONTEND_PID"
echo ""
echo "💡 To stop services manually:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "🔍 To monitor logs:"
echo "   Backend:  tail -f services/elide/logs.txt"
echo "   Frontend: Check terminal output"
