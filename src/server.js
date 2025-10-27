import express from "express";
import https from "https";
import net from "net";
// import dns from "dns";
// import { promisify } from "util";

// const dnsLookup = promisify(dns.lookup);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

const API_URL = "https://shadowmere.xyz/api/sub/?format=json";

// Fetch servers from API
function fetchServers() {
  return new Promise((resolve, reject) => {
    https
      .get(API_URL, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const servers = JSON.parse(data);
            resolve(servers);
          } catch (error) {
            reject(new Error(`Failed to parse JSON: ${error.message}`));
          }
        });
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

// Filter servers by country
function filterByCountry(servers, country) {
  if (!country) return servers;

  country = country.toLowerCase();
  return servers.filter((server) => {
    if (!server.remarks) return false;
    const remark = server.remarks.toLowerCase();

    if (remark.includes(country)) return true;

    const countryCodes = {
      uk: ["united kingdom", "gb"],
      us: ["united states", "usa"],
      nl: ["netherlands", "nl"],
      de: ["germany", "de"],
      fr: ["france", "fr"],
      ca: ["canada", "ca"],
      jp: ["japan", "jp"],
      sg: ["singapore", "sg"],
      pl: ["poland", "pl"],
      es: ["spain", "es"],
      it: ["italy", "it"],
      au: ["australia", "au"],
      nz: ["new zealand", "nz"],
    };

    if (countryCodes[country]) {
      return countryCodes[country].some((code) => remark.includes(code));
    }

    return false;
  });
}

// Get unique countries from servers
function getUniqueCountries(servers) {
  const countries = new Set();
  servers.forEach((server) => {
    if (server.remarks) {
      // Extract country from remarks (remove emoji and city details)
      let country = server.remarks;
      // Remove common city patterns
      country = country
        .replace(/🇬🇧|🇺🇸|🇸🇬|🇯🇵|🇳🇱|🇩🇪|🇫🇷|🇨🇦|🇦🇺|🇬🇧|[^a-zA-Z\s]/g, "")
        .trim();

      // Extract just the country name (usually after comma)
      const parts = country.split(",");
      if (parts.length > 1) {
        country = parts[parts.length - 1].trim();
      }

      if (country) {
        countries.add(country);
      }
    }
  });

  return Array.from(countries).sort();
}

// Ping server to check latency
function pingServer(server) {
  return new Promise((resolve) => {
    const hostname = server.server;
    const port = server.server_port || 443;

    const socket = new net.Socket();
    socket.setTimeout(2000);
    const start = Date.now();

    socket.connect(port, hostname, () => {
      const latency = Date.now() - start;
      socket.destroy();
      resolve(latency);
    });

    socket.on("error", () => {
      socket.destroy();
      resolve(Infinity);
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve(Infinity);
    });
  });
}

// API endpoint to get countries
app.get("/api/countries", async (req, res) => {
  try {
    const servers = await fetchServers();
    const countries = getUniqueCountries(servers);
    res.json({ countries });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to filter and test VPN servers
app.post("/api/find-vpn", async (req, res) => {
  try {
    const { country, url } = req.body;

    // Fetch servers
    const allServers = await fetchServers();
    console.log(`Found ${allServers.length} total servers`);

    // Filter by country
    const filteredServers = filterByCountry(allServers, country);
    console.log(
      `After filtering by ${country}: ${filteredServers.length} servers`
    );

    if (filteredServers.length === 0) {
      return res.json({
        success: false,
        message: "No servers found matching your criteria",
      });
    }

    // Remove duplicates
    const uniqueServers = [];
    const seen = new Set();
    for (const server of filteredServers) {
      const key = `${server.server}:${server.server_port}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueServers.push(server);
      }
    }

    // Test up to 30 servers
    const serversToTest = uniqueServers.slice(0, 30);
    console.log(`Testing ${serversToTest.length} servers...`);

    const results = [];

    for (let i = 0; i < serversToTest.length; i++) {
      const server = serversToTest[i];
      const latency = await pingServer(server);

      if (latency < Infinity) {
        results.push({
          ...server,
          latency,
        });
      }
    }

    // Sort by latency
    results.sort((a, b) => a.latency - b.latency);

    // Prepare top 3 results with config links
    const topResults = results.slice(0, 3).map((server) => {
      const auth = `${server.method}:${server.password}`;
      const encodedAuth = Buffer.from(auth).toString("base64");
      const remark = encodeURIComponent(server.remarks || "VPN");
      const configLink = `ss://${encodedAuth}@${server.server}:${server.server_port}#${remark}`;

      return {
        name: server.remarks || "Unknown",
        server: `${server.server}:${server.server_port}`,
        method: server.method,
        latency: server.latency,
        configLink: configLink,
      };
    });

    // Create subscription link (base64 encoded list of top 3 best servers)
    const subscriptionLinksArray = results.slice(0, 3).map((server) => {
      const auth = `${server.method}:${server.password}`;
      const encodedAuth = Buffer.from(auth).toString("base64");
      const remark = encodeURIComponent(server.remarks || "VPN");
      return `ss://${encodedAuth}@${server.server}:${server.server_port}#${remark}`;
    });

    const subscriptionLinksText = subscriptionLinksArray.join("\n");
    const subscriptionBase64 = Buffer.from(subscriptionLinksText).toString(
      "base64"
    );

    res.json({
      success: true,
      totalTested: serversToTest.length,
      working: results.length,
      results: topResults,
      subscriptionLink: subscriptionBase64,
      subscriptionLinks: subscriptionLinksArray,
      serversCount: results.length,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to serve subscription content for Hiddify and other VPN clients
app.get("/api/subscription", async (req, res) => {
  try {
    const { country, url } = req.query;

    if (!country) {
      return res.status(400).json({ error: "Country parameter required" });
    }

    // Fetch servers
    const allServers = await fetchServers();

    // Filter by country
    const filteredServers = filterByCountry(allServers, country);

    if (filteredServers.length === 0) {
      return res.status(404).json({ error: "No servers found" });
    }

    // Remove duplicates
    const uniqueServers = [];
    const seen = new Set();
    for (const server of filteredServers) {
      const key = `${server.server}:${server.server_port}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueServers.push(server);
      }
    }

    // Test up to 30 servers
    const serversToTest = uniqueServers.slice(0, 30);
    const results = [];

    for (let i = 0; i < serversToTest.length; i++) {
      const server = serversToTest[i];
      const latency = await pingServer(server);

      if (latency < Infinity) {
        results.push({
          ...server,
          latency,
        });
      }
    }

    // Sort by latency
    results.sort((a, b) => a.latency - b.latency);

    // Create subscription content in Shadowsocks format
    // Hiddify client expects ss:// links - return top 3 best configs
    const configs = results.slice(0, 3).map((server) => {
      const auth = `${server.method}:${server.password}`;
      const encodedAuth = Buffer.from(auth).toString("base64");
      const remark = encodeURIComponent(server.remarks || "VPN");
      return `ss://${encodedAuth}@${server.server}:${server.server_port}#${remark}`;
    });

    // Join all configs with newlines - this is the standard format
    const subscriptionContent = configs.join("\n");

    // Set proper headers for subscription
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    // Send the subscription content
    res.send(subscriptionContent);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to serve sing-box configuration format
app.get("/api/sing-box", async (req, res) => {
  try {
    const { country, url } = req.query;

    if (!country) {
      return res.status(400).json({ error: "Country parameter required" });
    }

    // Fetch servers
    const allServers = await fetchServers();

    // Filter by country
    const filteredServers = filterByCountry(allServers, country);

    if (filteredServers.length === 0) {
      return res.status(404).json({ error: "No servers found" });
    }

    // Remove duplicates
    const uniqueServers = [];
    const seen = new Set();
    for (const server of filteredServers) {
      const key = `${server.server}:${server.server_port}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueServers.push(server);
      }
    }

    // Test up to 30 servers
    const serversToTest = uniqueServers.slice(0, 30);
    const results = [];

    for (let i = 0; i < serversToTest.length; i++) {
      const server = serversToTest[i];
      const latency = await pingServer(server);

      if (latency < Infinity) {
        results.push({
          ...server,
          latency,
        });
      }
    }

    // Sort by latency and take top 3
    results.sort((a, b) => a.latency - b.latency);
    const bestServers = results.slice(0, 3);

    // Create sing-box configuration
    const outbounds = bestServers.map((server, index) => {
      const auth = Buffer.from(`${server.method}:${server.password}`).toString(
        "base64"
      );
      return {
        tag: `server-${index + 1}`,
        type: "shadowsocks",
        server: server.server,
        server_port: server.server_port,
        method: server.method,
        password: server.password,
      };
    });

    // Add selector outbound
    const selectorOutbound = {
      tag: "proxy",
      type: "selector",
      outbounds: ["auto", ...bestServers.map((_, i) => `server-${i + 1}`)],
    };

    // Add urltest outbound for auto selection
    const urltestOutbound = {
      type: "urltest",
      tag: "auto",
      outbounds: bestServers.map((_, i) => `server-${i + 1}`),
      url: "https://www.gstatic.com/generate_204",
      interval: "5m0s",
      interrupt_exist_connections: false,
    };

    // Create full sing-box config
    const singBoxConfig = {
      dns: {
        servers: [
          { address: "1.1.1.1", tag: "dns-1", detour: "direct" },
          { address: "8.8.8.8", tag: "dns-2" },
        ],
        rules: [],
        final: "dns-1",
        independent_cache: true,
        strategy: "ipv4_only",
      },
      inbounds: [
        {
          type: "mixed",
          tag: "mixed-in",
          listen: "127.0.0.1",
          listen_port: 2080,
        },
      ],
      outbounds: [
        selectorOutbound,
        urltestOutbound,
        ...outbounds,
        {
          type: "direct",
          tag: "direct",
        },
        {
          type: "block",
          tag: "block",
        },
      ],
      route: {
        rules: [
          {
            protocol: "dns",
            outbound: "dns-1",
          },
        ],
        geoip: {
          download_url:
            "https://github.com/SagerNet/sing-geoip/releases/latest/download/geoip.db",
          download_detour: "direct",
        },
        geosite: {
          download_url:
            "https://github.com/SagerNet/sing-geosite/releases/latest/download/geosite.db",
          download_detour: "direct",
        },
        default_interface: "auto",
        auto_detect_interface: true,
      },
      experimental: {
        cache_file: {
          enabled: true,
          path: "./cache.db",
        },
      },
    };

    // Return as JSON
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.json(singBoxConfig);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to serve Hiddify-compatible subscription format (like NiREvil warp.json)
app.get("/api/hiddify", async (req, res) => {
  try {
    const { country, url } = req.query;

    if (!country) {
      return res.status(400).json({ error: "Country parameter required" });
    }

    // Fetch servers
    const allServers = await fetchServers();

    // Filter by country
    const filteredServers = filterByCountry(allServers, country);

    if (filteredServers.length === 0) {
      return res.status(404).json({ error: "No servers found" });
    }

    // Remove duplicates
    const uniqueServers = [];
    const seen = new Set();
    for (const server of filteredServers) {
      const key = `${server.server}:${server.server_port}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueServers.push(server);
      }
    }

    // Test up to 30 servers
    const serversToTest = uniqueServers.slice(0, 30);
    const results = [];

    for (let i = 0; i < serversToTest.length; i++) {
      const server = serversToTest[i];
      const latency = await pingServer(server);

      if (latency < Infinity) {
        results.push({
          ...server,
          latency,
        });
      }
    }

    // Sort by latency and take top 3
    results.sort((a, b) => a.latency - b.latency);
    const bestServers = results.slice(0, 3);

    // Create Hiddify-compatible subscription format (like NiREvil)
    // Add metadata comments at the top
    const now = new Date();
    const timestamp = now.toLocaleString("en-US", {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Create emoji-based indicators
    const emojis = ["⚪️", "🔴", "🟢"];

    const subscriptionLines = [
      `//profile-title: base64:RnJlZWRvbSB0byBEcmVhbSDwn6SN`,
      `//profile-update-interval: 9`,
      `//subscription-userinfo: upload = 0; download = 0; total = 0; expire = 9999999999`,
      `//profile-web-page-url: https://github.com/hamiz-jafari/vpn`,
      `//last update on: ${timestamp}`,
    ];

    // Add server configs with Shadowsocks format
    const configs = bestServers.map((server, index) => {
      const auth = `${server.method}:${server.password}`;
      const encodedAuth = Buffer.from(auth).toString("base64");

      // Clean remark (remove emoji from original)
      let remark = server.remarks || "VPN";
      remark = remark.replace(/[🇺🇸🇬🇧🇸🇬🇯🇵🇳🇱🇩🇪🇫🇷🇨🇦🇦🇺]/g, "").trim();

      // Add emoji indicator based on latency position
      const emoji = emojis[index] || "⚪️";

      // Create Shadowsocks link with emoji
      const encodedRemark = encodeURIComponent(`${emoji} ${remark}`);

      return `ss://${encodedAuth}@${server.server}:${server.server_port}#${encodedRemark}`;
    });

    // Combine metadata and configs
    const subscriptionContent = [...subscriptionLines, ...configs].join("\n");

    // Set proper headers
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    res.send(subscriptionContent);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app
  .listen(PORT, () => {
    console.log(`🚀 VPN Filter Server running at http://localhost:${PORT}`);
    console.log(`Server is ready on port ${PORT}`);
  })
  .on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`❌ Port ${PORT} is already in use.`);
      console.error("Please stop the existing server or use a different port.");
      console.error(`To use a different port, set PORT environment variable:`);
      console.error(`PORT=${PORT + 1} node src/server.js`);
    } else {
      console.error("Server error:", err);
    }
    process.exit(1);
  });
