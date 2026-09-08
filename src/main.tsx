import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

// Register the RAKSHA offline application-shell service worker.
// Same-origin static caching only — API traffic is never intercepted (see public/sw.js).
if ("serviceWorker" in navigator && (import.meta.env.PROD || window.location.hostname === "localhost")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline shell is progressive enhancement; the app works without it */
    });
  });
}
