import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "framer-motion";
import { Lab } from "./Lab.tsx";
import "../styles.css";
import "./lab.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <Lab />
    </MotionConfig>
  </StrictMode>,
);
