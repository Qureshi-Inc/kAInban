#!/bin/bash

# Start development servers for Audio Task Manager

echo "🚀 Starting Audio Task Manager Development Environment"
echo ""

# Check if server dependencies are installed
if [ ! -d "server/node_modules" ]; then
    echo "📦 Installing server dependencies..."
    cd server && npm install && cd ..
fi

# Check if frontend dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

# Create storage directory
mkdir -p storage

echo ""
echo "✅ Setup complete!"
echo ""
echo "🎯 Starting servers..."
echo "   - API Server: http://localhost:3001"
echo "   - Frontend:   http://localhost:8064"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Start both servers using docker-compose dev profile
docker-compose --profile dev up