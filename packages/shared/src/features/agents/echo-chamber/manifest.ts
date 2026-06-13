import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const echoChamberAgentManifest = {
  id: "echo-chamber",
  name: "Echo Chamber",
  description: "Simulates a live streaming-style chat reacting to your roleplay in real time.",
  phase: "parallel",
  enabledByDefault: false,
  category: "misc",
  defaultTools: [],
} satisfies BuiltInAgentManifest;
