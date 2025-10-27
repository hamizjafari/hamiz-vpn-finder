#!/bin/bash
# Quick fix for port already in use error on cPanel

echo "🔍 Checking for processes using port 3252..."
lsof -i :3252

echo ""
echo "🛑 Killing Node.js processes..."
pkill -9 node

echo ""
echo "✅ Done! Port should now be free."
echo ""
echo "Now start your server with:"
echo "pnpm start"

