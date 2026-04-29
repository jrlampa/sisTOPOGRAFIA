import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./i18n"; // Import i18n configuration
import AppRouter from "./router";
import { initAnalytics } from "./utils/analytics";
import { resetChunkReloadFlag } from "./utils/lazyWithRetry";

// Initialize analytics
initAnalytics();

window.addEventListener("vite:preloadError", async (event) => {
  event.preventDefault();
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map((registration) => registration.unregister()),
    );
  }
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
  window.location.reload();
});

resetChunkReloadFlag();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>,
);
