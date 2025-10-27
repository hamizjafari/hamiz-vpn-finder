// URL mappings
const URL_MAP = {
  telegram: "https://web.telegram.org",
  instagram: "https://www.instagram.com",
};

// Load countries on page load
document.addEventListener("DOMContentLoaded", async () => {
  await loadCountries();
  setupUrlTypeListener();
});

// Load available countries
async function loadCountries() {
  try {
    const response = await fetch("/api/countries");
    const data = await response.json();

    const countrySelect = document.getElementById("country");
    countrySelect.innerHTML = '<option value="">Select a country...</option>';

    data.countries.forEach((country) => {
      const option = document.createElement("option");
      option.value = country;
      option.textContent = country;
      countrySelect.appendChild(option);
    });

    if (data.countries?.length > 0 && countrySelect.value === "") {
      //   countrySelect.defaultValue = "Germany";
      countrySelect.selectedIndex = data.countries.indexOf("Germany");
    }
  } catch (error) {
    console.error("Error loading countries:", error);
    document.getElementById("country").innerHTML =
      '<option value="">Error loading countries</option>';
  }
}

// Setup URL type listener
function setupUrlTypeListener() {
  const urlTypes = document.querySelectorAll('input[name="urlType"]');

  urlTypes.forEach((radio) => {
    radio.addEventListener("change", (e) => {
      const customUrlInput = document.getElementById("customUrl");
      if (e.target.value === "custom") {
        customUrlInput.style.display = "block";
      } else {
        customUrlInput.style.display = "none";
      }
    });
  });
}

// Handle form submission
document.getElementById("vpnForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const country = document.getElementById("country").value;
  const urlType = document.querySelector('input[name="urlType"]:checked').value;
  const customUrl = document.getElementById("customUrl").value;

  let targetUrl = "";
  if (urlType === "custom") {
    targetUrl = customUrl;
  } else {
    targetUrl = URL_MAP[urlType];
  }

  if (!country) {
    showError("Please select a country");
    return;
  }

  // Show loading
  document.getElementById("loading").style.display = "block";
  document.getElementById("results").style.display = "none";
  document.getElementById("error").style.display = "none";

  try {
    const response = await fetch("/api/find-vpn", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ country, url: targetUrl }),
    });

    const data = await response.json();

    // Hide loading
    document.getElementById("loading").style.display = "none";

    if (data.success) {
      await showResults(data);
    } else {
      showError(data.message || "Failed to find VPN servers");
    }
  } catch (error) {
    console.error("Error:", error);
    document.getElementById("loading").style.display = "none";
    showError("Network error: " + error.message);
  }
});

// Show results
async function showResults(data) {
  const resultsDiv = document.getElementById("results");
  const contentDiv = document.getElementById("resultsContent");

  let html = `
        <div class="stats">
            Tested <strong>${data.totalTested}</strong> servers,
            <strong>${data.working}</strong> working
        </div>
    `;

  // Add subscription link section
  if (data.subscriptionLink) {
    // Create subscription URL that can be added to Hiddify
    const country = encodeURIComponent(
      document.getElementById("country").value
    );
    const urlType = document.querySelector(
      'input[name="urlType"]:checked'
    ).value;
    const customUrl = document.getElementById("customUrl").value;
    let targetUrl = "";
    if (urlType === "custom") {
      targetUrl = customUrl;
    } else {
      targetUrl = URL_MAP[urlType];
    }
    const subscriptionUrl = `${
      window.location.origin
    }/api/subscription?country=${country}&url=${encodeURIComponent(targetUrl)}`;

    const singboxUrl = `${
      window.location.origin
    }/api/sing-box?country=${country}&url=${encodeURIComponent(targetUrl)}`;

    const hiddifyUrl = `${
      window.location.origin
    }/api/hiddify?country=${country}&url=${encodeURIComponent(targetUrl)}`;

    const singboxJson = await loadSingBoxConfig(singboxUrl);
    console.log("singboxJson", singboxJson);

    html += `
            <div class="subscription-box">
                <h4>📋 Subscription Links - Copy to Import</h4>
                <p>Choose your preferred format and click Copy, then add to your VPN client</p>

                <div style="margin-top: 20px;">


                <div style="padding: 15px; background: white; border-radius: 10px; border: 2px solid #e0e0e0;">
                <h4 style="color: #667eea; margin-bottom: 10px; display: flex; align-items: center;">
                    <span style="font-size: 1.5em; margin-right: 8px;">🔷</span>
                    Hiddify Format
                </h4>
                <p style="font-size: 0.9em; color: #666; margin-bottom: 8px;">✅ Hiddify | ✅ Visual emoji indicators (⚪️🔴🟢)</p>
                <div style="position: relative;">
                    <div class="config-link" id="hiddify-url">${
                      data.subscriptionLink || hiddifyUrl
                    }</div>
                    <button class="copy-btn" onclick="copyConfig('full-subscription', this)">📋 Copy</button>
                </div>
            </div>

                    <div style="margin-bottom: 20px; padding: 15px; background: white; border-radius: 10px; border: 2px solid #e0e0e0;">
                        <h4 style="color: #667eea; margin-bottom: 10px; display: flex; align-items: center;">
                            <span style="font-size: 1.5em; margin-right: 8px;">⚙️</span>
                            Sing-box JSON Format
                        </h4>
                        <p style="font-size: 0.9em; color: #666; margin-bottom: 8px;">✅ Sing-box | ✅ Hiddify | ✅ Auto-selector enabled</p>
                        <div style="position: relative; margin-bottom: 15px;">
                            <div class="config-link" id="singbox-url">${singboxUrl}</div>
                            <button class="copy-btn" onclick="copyConfig('singbox-url', this)">📋 Copy</button>
                        </div>
                        <div style="margin-top: 15px; position: relative;">
                            <div id="singbox-json" class="config-link" style="font-size: 0.8em; max-height: 100px; overflow-y: auto; white-space: pre-wrap; font-family: monospace; min-height: 100px; display: flex; align-items: center; justify-content: center; color: #999;">
                            ${singboxJson || "Loading JSON..."}
                            </div>
                            <button class="copy-btn" onclick="copyConfig('singbox-json', this)" style="position: absolute; top: 10px; right: 10px;">📋 Copy JSON</button>
                            <div style="margin-top: 40px;"></div>
                        </div>
                    </div>


                          <div style="margin-bottom: 20px; padding: 15px; background: white; border-radius: 10px; border: 2px solid #e0e0e0;">
                        <h4 style="color: #667eea; margin-bottom: 10px; display: flex; align-items: center;">
                            <span style="font-size: 1.5em; margin-right: 8px;">🌐</span>
                            Shadowsocks Format (ss://)
                        </h4>
                        <p style="font-size: 0.9em; color: #666; margin-bottom: 8px;">✅ Hiddify | ✅ Clash | ✅ V2Ray | ✅ Shadowsocks</p>
                        <div style="position: relative;">
                            <div class="config-link" id="subscription-url">${subscriptionUrl}</div>
                            <button class="copy-btn" onclick="copyConfig('subscription-url', this)">📋 Copy</button>
                        </div>
                    </div>
                </div>

                <details open style="margin-top: 20px;">
                    <summary style="cursor: pointer; font-weight: 600; color: #667eea;">📋 Show Full Subscription Content (Copy This)</summary>
                    <div style="margin-top: 10px;">
                        <p style="font-size: 0.85em; color: #666; margin-bottom: 8px;">Copy this entire content and add to your VPN client:</p>
                        <div class="config-link" id="full-subscription" style="font-size: 0.85em; max-height: 300px; overflow-y: auto; white-space: pre-wrap; font-family: monospace;">${
                          data.subscriptionLink
                        }</div>
                        <button class="copy-btn" onclick="copyConfig('full-subscription', this)" style="position: absolute; top: 10px; right: 10px;">📋 Copy All</button>
                        <div style="margin-top: 40px;"></div>
                    </div>
                </details>
            </div>
        `;
  }

  data.results.forEach((server, index) => {
    html += `
            <div class="vpn-item">
                <div class="vpn-item-header">
                    <h3>${index + 1}. ${server.name}</h3>
                    <span class="latency-badge">${server.latency}ms</span>
                </div>
                <div class="vpn-item-info">
                    <div>
                        <strong>Server:</strong>
                        ${server.server}
                    </div>
                    <div>
                        <strong>Method:</strong>
                        ${server.method}
                    </div>
                </div>
                <div style="position: relative;">
                    <div class="config-link" id="config-${index}">${
      server.configLink
    }</div>
                    <button class="copy-btn" onclick="copyConfig('config-${index}', this)">Copy</button>
                </div>
            </div>
        `;
  });

  contentDiv.innerHTML = html;
  resultsDiv.style.display = "block";

  // Scroll to results
  resultsDiv.scrollIntoView({ behavior: "smooth", block: "start" });

  // Load sing-box JSON configuration after DOM is updated
}

// Load Sing-box JSON configuration
async function loadSingBoxConfig(url) {
  try {
    const response = await fetch(url);
    const config = await response.json();
    const formattedJson = JSON.stringify(config, null, 2);

    return formattedJson;

    // console.log("formattedJson", formattedJson);

    // const jsonElement = document.getElementById("singbox-json");
    // if (jsonElement) {
    //   jsonElement.textContent = formattedJson;
    //   jsonElement.style.color = "#333";
    // }
  } catch (error) {
    console.error("Error loading Sing-box config:", error);
    return "Failed to load JSON configuration";
    // const jsonElement = document.getElementById("singbox-json");
    // if (jsonElement) {
    //   jsonElement.textContent = "Failed to load JSON configuration";
    //   jsonElement.style.color = "#d32f2f";
    // }
  }
}

// Show error
function showError(message) {
  const errorDiv = document.getElementById("error");
  errorDiv.textContent = message;
  errorDiv.style.display = "block";
}

// Copy config to clipboard
function copyConfig(configId, button) {
  const configElement = document.getElementById(configId);
  const text = configElement.textContent;

  navigator.clipboard
    .writeText(text)
    .then(() => {
      button.textContent = "Copied!";
      button.classList.add("copied");

      setTimeout(() => {
        button.textContent = "Copy";
        button.classList.remove("copied");
      }, 2000);
    })
    .catch((err) => {
      console.error("Failed to copy:", err);
      alert("Failed to copy to clipboard");
    });
}

// Make copyConfig available globally
window.copyConfig = copyConfig;
