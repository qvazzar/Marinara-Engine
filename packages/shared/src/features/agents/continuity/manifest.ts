import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const continuityAgentManifest = {
  id: "continuity",
  name: "Continuity Checker",
  description: "Detects contradictions with established lore and facts.",
  phase: "post_processing",
  enabledByDefault: false,
  category: "writer",
  defaultTools: ["search_lorebook"],
} satisfies BuiltInAgentManifest;
