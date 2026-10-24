// Presentation only: where each project stands on the city grid and how it is drawn. Kept apart from
// the manifest so that moving a building can never change what a project claims.

import type { DistrictId, ProjectId } from "./manifest.ts";

/** Plot on the 3 × 3 grid, 0..2 × 0..2. (1,1) is the centre tower; (0,0) is the Data Foundry. */
export const PLOTS: Record<ProjectId, [number, number]> = {
  "strategy-lab": [1, 1],
  dcf: [2, 1],
  "risk-tolerance": [2, 2],
  "deal-lab": [1, 2],
  "twin-engine": [0, 2],
  sentinel: [0, 1],
  jarvis: [2, 0],
  "high-properties": [1, 0],
};
export const FOUNDRY: [number, number] = [0, 0];

// One cool family (cyan to violet), as on the Perspective Engine board: identity by hue within the
// family, never by contrasting colours. Status colours (failed, stale, running) live in City.tsx.
export const COLORS: Record<ProjectId, string> = {
  "strategy-lab": "#2bf0ff",
  dcf: "#5ee6f0",
  "risk-tolerance": "#45cbe6",
  "deal-lab": "#8fe6ff",
  "twin-engine": "#a78bff",
  sentinel: "#c2adff",
  jarvis: "#6fb4ff",
  "high-properties": "#9f8cff",
};

export const DISTRICT_COLORS: Record<DistrictId, string> = {
  "capital-markets": "#2bf0ff",
  "investment-underwriting": "#8fe6ff",
  "risk-reliability": "#c2adff",
  "automation-product": "#9f8cff",
};
