import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "framer-motion";
import { Deal } from "./Deal.tsx";
import "../styles.css";
import "../lab/lab.css";
import "./deal.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <Deal />
    </MotionConfig>
  </StrictMode>,
);
