import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const editorAgentManifest = {
  id: "editor",
  name: "Consistency Editor",
  description:
    "Reads all agent data (tracker states, prose rules, continuity notes) and edits the model's response to fix factual errors, outfit/stat contradictions, repetition, and other inconsistencies.",
  phase: "post_processing",
  enabledByDefault: false,
  category: "writer",
  defaultTools: [],
} satisfies BuiltInAgentManifest;
