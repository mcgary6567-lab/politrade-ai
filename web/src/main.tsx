import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      // a new build arrived: activate it on the next navigation instead of waiting for all tabs to close
      reg.addEventListener("updatefound", () => reg.installing?.addEventListener("statechange", () => { if (reg.waiting) reg.waiting.postMessage("skipWaiting"); }));
    }).catch(() => { /* not critical */ });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
