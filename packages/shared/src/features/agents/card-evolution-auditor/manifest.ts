import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const cardEvolutionAuditorAgentManifest = {
  id: "card-evolution-auditor",
  name: "Card Evolution Auditor",
  description:
    "Detects when character card fields (description, personality, scenario, etc.) have become outdated based on roleplay events and proposes edits for user approval.",
  phase: "post_processing",
  enabledByDefault: false,
  category: "tracker",
  defaultTools: [],
  runInterval: 8,
} satisfies BuiltInAgentManifest;
