process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import V2RayManager from "./v2ray-manager.js";
import { SocksProxyAgent } from "socks-proxy-agent";

// Global error handlers
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  // Don't exit the process, let it continue running
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Don't exit the process, let it continue running
});

async function main() {
  const v2rayManager = new V2RayManager();

  // Try to start V2Ray with fallback to API configs
  const started = await v2rayManager.startWithFallback();

  if (!started) {
    console.error("Failed to start V2Ray with fallback");
    process.exit(1);
  }

  console.log("Waiting for V2Ray to fully start...");
  await sleep(3000);

  // Monitor V2Ray process
  const v2ray = v2rayManager.getV2RayProcess();
  if (v2ray) {
    v2ray.stdout?.on("data", (data) => {
      console.log(`[V2Ray] ${data}`);
    });

    v2ray.stderr?.on("data", (data) => {
      const text = data.toString();
      console.error(`[V2Ray ERROR] ${text}`);

      // Check for fatal errors and attempt to restart with fallback
      if (/fatal|failed|panic/i.test(text) && !/warning/i.test(text)) {
        console.error("Critical V2Ray error detected, attempting recovery...");
        v2rayManager.stop().then(() => {
          console.log("Attempting to restart with fallback config...");
          v2rayManager.startWithFallback();
        });
      }
    });

    v2ray.on("error", async (err) => {
      console.error(`[V2Ray PROCESS ERROR] ${err.message || err}`);
      await v2rayManager.stop();
    });

    v2ray.on("exit", async (code) => {
      console.log(`V2Ray process exited with code ${code}`);
      if (code !== 0) {
        console.log("Attempting to restart with fallback...");
        await v2rayManager.startWithFallback();
      }
    });
  }

  console.log("Initializing socks5 proxy and bot...");
  const proxy = new SocksProxyAgent("socks5://127.0.0.1:2080");

  try {
    await initBot({ agent: proxy });
  } catch (err) {
    console.error("Request failed:", err.message);
    await v2rayManager.stop();
  }
}

main().catch((error) => {
  console.error("Fatal error in main:", error);
  process.exit(1);
});
