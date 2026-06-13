import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const illustratorAgentManifest = {
  id: "illustrator",
  name: "Illustrator",
  description: "Generates image prompts for key scenes (requires image generation API).",
  phase: "post_processing",
  enabledByDefault: false,
  category: "misc",
  defaultTools: [],
  defaultSettings: {
    useAvatarReferences: false,
  },
  runInterval: 5,
} satisfies BuiltInAgentManifest;
