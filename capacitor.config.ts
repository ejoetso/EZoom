import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ezoom.education",
  appName: "EZoom",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
};

export default config;
