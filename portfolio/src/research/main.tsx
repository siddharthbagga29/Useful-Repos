import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "framer-motion";
import { ResearchHQ } from "./ResearchHQ.tsx";
import "../styles.css";
import "../lab/lab.css";
import "./hq.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <ResearchHQ />
    </MotionConfig>
  </StrictMode>,
);
