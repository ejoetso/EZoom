// Native bundles load their UI locally and use the HTTPS classroom service for data.
const configuredBase = (import.meta as ImportMeta & { env: { VITE_EZOOM_API_URL?: string } }).env.VITE_EZOOM_API_URL?.trim();
export const isNative = window.location.protocol === "capacitor:" || (window.location.hostname === "localhost" && !!(window as any).Capacitor);
export const hasNativeApi = !isNative || !!configuredBase;
export const apiBase = configuredBase ? configuredBase.replace(/\/$/, "") : isNative ? "" : window.location.origin;

export function apiUrl(path: string) { return `${apiBase}${path}`; }
export function websocketUrl(path: string) { return `${apiBase.replace(/^http/, "ws")}${path}`; }
