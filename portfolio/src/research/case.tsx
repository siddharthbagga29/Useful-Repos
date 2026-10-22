import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "framer-motion";
import { CaseStudy } from "./CaseStudy.tsx";
import { loadAnalytics, track } from "../lib/track.ts";
import { protectContent } from "../lib/protect.ts";
import "../styles.css";
import "../lab/lab.css";
import "./hq.css";
import "./case.css";

protectContent();
const root = document.getElementById("root")!;
const id = root.dataset.project ?? location.pathname.split("/").filter(Boolean).at(-1) ?? "";
loadAnalytics();
track("page_view", { page: `case:${id}` }, true);

createRoot(root).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <CaseStudy id={id} />
    </MotionConfig>
  </StrictMode>,
);
