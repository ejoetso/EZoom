import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const apiBase = (process.env.VITE_EZOOM_API_URL || "").trim().replace(/\/$/, "");
const errors = [];

if (!apiBase.startsWith("https://")) errors.push("VITE_EZOOM_API_URL must name the deployed HTTPS EZoom API; no default server is used for iOS releases.");

const iconPath = path.join(root, "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-EZoom-1024.png");
if (!fs.existsSync(iconPath)) errors.push("Branded 1024px app icon is missing.");
else {
  const png = fs.readFileSync(iconPath);
  if (png.readUInt32BE(16) !== 1024 || png.readUInt32BE(20) !== 1024) errors.push("App icon must be 1024 × 1024 pixels.");
}

const plist = fs.readFileSync(path.join(root, "ios/App/App/Info.plist"), "utf8");
for (const key of ["NSCameraUsageDescription", "NSMicrophoneUsageDescription"]) {
  if (!plist.includes(`<key>${key}</key>`)) errors.push(`${key} is missing from Info.plist.`);
}

const nativeConfig = JSON.parse(fs.readFileSync(path.join(root, "ios/App/App/capacitor.config.json"), "utf8"));
if (nativeConfig.server?.url) errors.push("The iOS app still loads a remote website instead of bundled assets.");

for (const [endpoint, expected] of apiBase.startsWith("https://") ? [["/api/health", "ok"], ["/api/license/status", undefined]] : []) {
  try {
    const response = await fetch(`${apiBase}${endpoint}`, { signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok || (expected && data.status !== expected) || (endpoint === "/api/health" && data.service !== "EZoom") || (endpoint === "/api/license/status" && typeof data.active !== "boolean")) {
      errors.push(`${endpoint} did not return the expected EZoom JSON response.`);
    }
  } catch {
    errors.push(`${endpoint} is unavailable or does not return JSON at ${apiBase}.`);
  }
}

if (errors.length) {
  console.error("iOS release check failed:\n" + errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("iOS source and HTTPS API preflight passed. Build, sign, and test on a Mac before submission.");
}
