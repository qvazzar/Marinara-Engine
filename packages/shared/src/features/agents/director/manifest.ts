import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const directorAgentManifest = {
  id: "director",
  name: "Narrative Director",
  description: "Introduces events, NPCs, and plot beats to keep the story moving.",
  phase: "pre_generation",
  enabledByDefault: false,
  defaultInjectAsSection: true,
  category: "writer",
  defaultTools: ["trigger_event"],
  runInterval: 5,
} satisfies BuiltInAgentManifest;
