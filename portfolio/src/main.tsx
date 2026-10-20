import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "framer-motion";
import App from "./App.tsx";
import { JarvisProvider } from "./jarvis/JarvisProvider.tsx";
import "./styles.css";
import { protectContent } from "./lib/protect.ts";

protectContent();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <JarvisProvider>
        <App />
      </JarvisProvider>
    </MotionConfig>
  </StrictMode>,
);
