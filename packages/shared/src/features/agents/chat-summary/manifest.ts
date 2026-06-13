import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const chatSummaryAgentManifest = {
  id: "chat-summary",
  name: "Automated Chat Summary",
  description:
    "Automatically generates a rolling summary of the conversation every X user messages. Add to a chat for hands-free summary updates.",
  phase: "post_processing",
  enabledByDefault: false,
  category: "misc",
  defaultTools: [],
  runInterval: 5,
} satisfies BuiltInAgentManifest;
