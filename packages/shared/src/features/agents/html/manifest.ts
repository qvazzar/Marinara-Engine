import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const htmlAgentManifest = {
  id: "html",
  name: "Immersive HTML",
  description:
    "Injects a prompt directive that encourages the model to include inline HTML, CSS, and JS for immersive in-world visual elements.",
  phase: "pre_generation",
  enabledByDefault: false,
  category: "misc",
  defaultTools: [],
} satisfies BuiltInAgentManifest;
