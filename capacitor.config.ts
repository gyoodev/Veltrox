import type { CapacitorConfig } from "@capacitor/cli";

const rawServerUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() || "https://veltrox-one.vercel.app";
const normalizedServerUrl = rawServerUrl.replace(/\/+$/, "");

const config: CapacitorConfig = {
  appId: "app.veltrox.mobile",
  appName: "Veltrox",
  webDir: "capacitor-web",
  backgroundColor: "#090d16",
  server: {
    url: normalizedServerUrl,
    androidScheme: "https",
    errorPath: "index.html",
    allowNavigation: [
      "veltrox-one.vercel.app",
      "*.vercel.app",
      "veltrox.app",
      "*.veltrox.app",
      "checkout.stripe.com",
      "billing.stripe.com",
    ],
  },
  android: {
    backgroundColor: "#090d16",
    allowMixedContent: false,
    captureInput: false,
    adjustMarginsForEdgeToEdge: "auto",
  },
  ios: {
    backgroundColor: "#090d16",
    contentInset: "automatic",
    scrollEnabled: true,
    scheme: "App",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#090d16",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#090d16",
      overlaysWebView: false,
    },
  },
};

export default config;

