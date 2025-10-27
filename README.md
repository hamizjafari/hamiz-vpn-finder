# VPN Server Finder 🚀

A web application to find the fastest VPN servers for specific countries and URLs.

## Features

- 🌍 **Country Selection**: Filter VPN servers by country
- 📱 **Popular URLs**: Quick selection for Telegram and Instagram
- 🔗 **Custom URLs**: Test against any URL you specify
- ⚡ **Speed Testing**: Automatically tests and ranks servers by latency
- 📋 **Easy Copy**: One-click copy for Shadowsocks configuration links

## Installation

```bash
pnpm install
```

## Usage

### Start the server

```bash
pnpm start
```

Then open your browser and go to: **http://localhost:3000**

### Command Line Usage

You can also use the filter script directly from the command line:

```bash
node src/filter-vpn.js --country "United Kingdom"
node src/filter-vpn.js --country "United States" --url https://www.google.com
node src/filter-vpn.js -c Japan -u https://www.instagram.com
```

## API Endpoints

### Get Available Countries
```bash
GET /api/countries
```

### Find Best VPN Servers
```bash
POST /api/find-vpn
Content-Type: application/json

{
  "country": "United States",
  "url": "https://www.google.com"
}
```

Response:
```json
{
  "success": true,
  "totalTested": 30,
  "working": 25,
  "results": [
    {
      "name": "🇺🇸 Santa Clara, CA, United States",
      "server": "23.157.40.5:443",
      "method": "aes-256-gcm",
      "latency": 0,
      "configLink": "ss://..."
    }
  ]
}
```

## Project Structure

```
vpn/
├── src/
│   ├── server.js       # Express backend server
│   ├── filter-vpn.js   # CLI script for VPN filtering
│   └── app.js          # Original app
├── public/
│   ├── index.html      # Frontend HTML
│   ├── style.css       # Frontend styling
│   └── script.js       # Frontend JavaScript
├── package.json
└── README.md
```

## How It Works

1. **Fetch Servers**: Retrieves VPN servers from the Shadowmere API
2. **Filter by Country**: Filters servers based on selected country
3. **Test Latency**: Pings each server to measure connection speed
4. **Sort Results**: Returns top 3 fastest servers
5. **Generate Config**: Creates Shadowsocks (ss://) configuration links

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari

## License

ISC

