import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const lorebookKeeperAgentManifest = {
  id: "lorebook-keeper",
  name: "Lorebook Keeper",
  description:
    "Automatically creates and updates lorebook entries based on story events, new characters, and world changes.",
  phase: "post_processing",
  enabledByDefault: false,
  category: "misc",
  defaultTools: ["search_lorebook"],
  runInterval: 8,
} satisfies BuiltInAgentManifest;
