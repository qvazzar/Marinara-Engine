import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const proseGuardianAgentManifest = {
  id: "prose-guardian",
  name: "Prose Guardian",
  description:
    "Analyzes recent messages for repetition, rhetorical patterns, and sentence structure — then generates strict writing directives to force variety and freshness.",
  phase: "pre_generation",
  enabledByDefault: false,
  category: "writer",
  defaultTools: [],
} satisfies BuiltInAgentManifest;
