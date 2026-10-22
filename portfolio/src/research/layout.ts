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

export const COLORS: Record<ProjectId, string> = {
  "strategy-lab": "#22d3ee",
  dcf: "#34d399",
  "risk-tolerance": "#5eead4",
  "deal-lab": "#fbbf24",
  "twin-engine": "#f472b6",
  sentinel: "#a78bfa",
  jarvis: "#60a5fa",
  "high-properties": "#818cf8",
};

export const DISTRICT_COLORS: Record<DistrictId, string> = {
  "capital-markets": "#22d3ee",
  "investment-underwriting": "#fbbf24",
  "risk-reliability": "#a78bfa",
  "automation-product": "#60a5fa",
};
