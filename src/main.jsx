import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import "./styles.css";
import "./crud.css";
import "./temperature.css";
import "./features.css";
import "./dark.css";
import "./dark-tweaks.css";
import { applyScheme, readScheme } from "./scheme.js";
applyScheme(readScheme());
createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
