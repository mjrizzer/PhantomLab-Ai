export type Result = {
  id: string;
  release: string;
  scenario: string;
  passed: boolean;
  status: string;
  assertion?: string;
  error?: string;
  duration_ms: number;
  evidence: Record<string, unknown>;
  screenshots: string[];
  trace?: string;
  steps: string[];
  reproduction?: string[];
  console: string[];
  network: unknown[];
};
export type LabEvent = {
  at: string;
  actor: string;
  message: string;
  kind?: string;
  screenshot?: string;
  release?: string;
  scenario?: string;
};
export type Agent = {
  role: string;
  summary?: string;
  uncertainty?: string;
  source: string;
  error?: string;
};
export type Experiment = {
  id: string;
  title: string;
  objective: string;
  status: string;
  mode: string;
  persona?: string;
  scenarios?: string[];
  created: string;
  events: LabEvent[];
  results: Result[];
  agents: Agent[];
  risk?: {
    verdict: string;
    mode: string;
    new_regressions: number;
    limitations: string;
    reason: string;
  };
  anomalies?: { available: boolean; reason: string; flags?: boolean[] };
  environment?: Record<string, string>;
  error?: string;
  ai_degraded?: boolean;
};
export type Product = {
  id: string;
  name: string;
  description: string;
  url: string;
  origin: string;
  release: string;
  category: string;
  versions: string[];
  scenarios: string[];
};
export type Health = {
  backend: boolean;
  database: boolean;
  worker: boolean;
  active: number;
  queued: number;
  storage_bytes: number;
  artifact_bytes: number;
  ollama: {
    available: boolean;
    service: boolean;
    model: string;
    installed: string[];
  };
};
export const SCENARIOS = [
  "single_checkout",
  "rapid_checkout",
  "discount",
  "keyboard",
  "slow_network",
];
export const pretty = (s: string) =>
  s.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
