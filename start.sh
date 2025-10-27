#!/bin/bash
# Start script for cPanel deployment

# Kill existing node processes
pkill -9 node 2>/dev/null

# Wait a moment for ports to free
sleep 2

# Start the server
echo "🚀 Starting VPN Filter Server..."
cd "$(dirname "$0")"
pnpm start

