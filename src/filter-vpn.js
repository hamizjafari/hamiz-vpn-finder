import https from "https";
import dns from "dns";
import net from "net";
import { promisify } from "util";

const dnsLookup = promisify(dns.lookup);

const API_URL = "https://shadowmere.xyz/api/sub/?format=json";

// Parse command line arguments
const args = process.argv.slice(2);
let targetUrl = "";
let countryFilter = "";

// Parse arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--url" || args[i] === "-u") {
    targetUrl = args[i + 1];
    i++;
  } else if (args[i] === "--country" || args[i] === "-c") {
    countryFilter = args[i + 1];
    i++;
  }
}

console.log("VPN Server Speed Filter");
console.log("========================");
console.log(`Target URL: ${targetUrl || "Not specified"}`);
console.log(`Country Filter: ${countryFilter || "All countries"}`);
console.log("");

// Fetch data from API
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

    // Check for country name in remarks
    if (remark.includes(country)) return true;

    // Check for common country codes
    const countryCodes = {
      uk: ["united kingdom", "gb"],
      us: ["united states", "usa"],
      nl: ["netherlands", "nl"],
      de: ["germany", "de"],
      fr: ["france", "fr"],
      ca: ["canada", "ca"],
      jp: ["japan", "jp"],
      sg: ["singapore", "sg"],
    };

    if (countryCodes[country]) {
      return countryCodes[country].some((code) => remark.includes(code));
    }

    return false;
  });
}

// Ping server to check latency using net module
function pingServer(server) {
  return new Promise((resolve) => {
    const hostname = server.server;
    const port = server.server_port || 443;

    const socket = new net.Socket();
    let latency = Infinity;

    socket.setTimeout(2000);
    const start = Date.now();

    socket.connect(port, hostname, () => {
      latency = Date.now() - start;
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

// Main function
async function main() {
  try {
    console.log("Fetching servers from API...\n");
    const allServers = await fetchServers();
    console.log(`Found ${allServers.length} servers\n`);

    // Filter by country
    const filteredServers = filterByCountry(allServers, countryFilter);
    console.log(
      `After filtering by country: ${filteredServers.length} servers\n`
    );

    if (filteredServers.length === 0) {
      console.log("No servers found matching your criteria.");
      process.exit(0);
    }

    // Remove duplicates based on server:port combination
    const uniqueServers = [];
    const seen = new Set();
    for (const server of filteredServers) {
      const key = `${server.server}:${server.server_port}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueServers.push(server);
      }
    }

    // Test servers (limit to first 30 for performance)
    const serversToTest = uniqueServers.slice(0, 30);
    console.log(
      `Testing ${serversToTest.length} unique servers for latency...\n`
    );

    const results = [];

    for (let i = 0; i < serversToTest.length; i++) {
      const server = serversToTest[i];
      process.stdout.write(
        `Testing ${i + 1}/${serversToTest.length}: ${server.server}:${
          server.server_port
        } (${server.remarks})... `
      );

      const latency = await pingServer(server);

      if (latency < Infinity) {
        results.push({
          ...server,
          latency,
        });
        console.log(`✓ ${latency}ms`);
      } else {
        console.log("✗ Timeout/Failed");
      }
    }

    // Sort by latency (best first)
    results.sort((a, b) => a.latency - b.latency);

    console.log("\n\nBest Servers (sorted by speed):");
    console.log("===================================\n");

    const topN = Math.min(5, results.length);

    // Show top 3 configs with complete connection links
    const top3 = Math.min(3, results.length);

    for (let i = 0; i < topN; i++) {
      const server = results[i];
      console.log(`${i + 1}. ${server.remarks || "Unknown"}`);
      console.log(`   Server: ${server.server}:${server.server_port}`);
      console.log(`   Method: ${server.method}`);
      console.log(`   Latency: ${server.latency}ms`);
      console.log(`   Password: ${server.password}`);
      console.log("");
    }

    if (results.length > 0) {
      console.log("\nBest VPN Configuration Links:");
      console.log("===================================");

      for (let i = 0; i < top3; i++) {
        const server = results[i];
        // Correct Shadowsocks URI format: ss://method:password@server:port#name
        const auth = `${server.method}:${server.password}`;
        const encodedAuth = Buffer.from(auth).toString("base64");
        const remark = encodeURIComponent(server.remarks || "VPN");
        const configLink = `ss://${encodedAuth}@${server.server}:${server.server_port}#${remark}`;

        console.log(
          `\n${i + 1}. ${server.remarks || "Unknown"} (${server.latency}ms)`
        );
        console.log(configLink);
      }
    }
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

// Show usage if no arguments
if (args.length === 0) {
  console.log(`
Usage: node filter-vpn.js [options]

Options:
  --url, -u <url>         URL to test speed against
  --country, -c <country> Filter by country (e.g., "United States", "UK", "Japan")

Examples:
  node filter-vpn.js --country UK
  node filter-vpn.js --country "United States" --url https://www.google.com
  node filter-vpn.js --country Japan -u https://www.github.com

Note: For best results, specify both a country filter and a target URL.
`);
  process.exit(0);
}

main();
