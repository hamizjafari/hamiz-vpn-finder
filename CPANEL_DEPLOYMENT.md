# cPanel Deployment Guide

## Fix for Port Already In Use Error

If you're getting `Error: listen EADDRINUSE: address already in use :::3252`, here's how to fix it:

### Solution 1: Kill Existing Process

Connect via SSH and kill the existing process:

```bash
# Find the process using the port
lsof -i :3252

# Kill the process (replace PID with the actual process ID)
kill -9 <PID>

# Or kill all node processes
pkill -9 node
```

### Solution 2: Use Environment Variable

Update your start command in cPanel to use the PORT variable:

```bash
PORT=3252 pnpm start
```

Or in your `package.json`, update the start script:

```json
{
  "scripts": {
    "start": "node src/server.js"
  }
}
```

And in cPanel, set the environment variable `PORT=3252`.

### Solution 3: Let cPanel Assign Port Dynamically

The server now reads `process.env.PORT` which cPanel will provide automatically.

### For cPanel Deployment

1. **Upload files** to `/home/username/vpnfinder/`
2. **Install dependencies:**
   ```bash
   cd ~/vpnfinder
   pnpm install
   ```
3. **Set up app in cPanel:**
   - Go to Node.js app in cPanel
   - Create new app
   - Set startup file: `src/server.js`
   - Port will be auto-assigned (like 3252)
   - Click "Run npm install"
   - Click "Start" or "Restart"

### Verify Deployment

Once deployed, your app will be available at:

```
https://yourdomain.com/node/
```

Or with the assigned port:

```
https://yourdomain.com:3252
```

### Environment Variables in cPanel

You can set custom environment variables in cPanel:

1. Go to Node.js app settings
2. Click "Settings" → "Environment Variables"
3. Add any custom variables needed

### Troubleshooting

**Port in use:**

- SSH in and run: `pkill -9 node`
- Restart the app in cPanel

**Module not found:**

- Run: `pnpm install` via SSH
- Or use cPanel's "Run npm install" button

**File permissions:**

```bash
chmod 755 ~/vpnfinder
chmod 644 ~/vpnfinder/src/server.js
```
