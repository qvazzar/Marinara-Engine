import type { AgentCategory, AgentPhase, AgentResultType } from "../../types/agent.js";
import type { ChatMode } from "../../types/chat.js";

export interface BuiltInAgentManifest {
  id: string;
  name: string;
  description: string;
  phase: AgentPhase;
  enabledByDefault: boolean;
  defaultInjectAsSection?: boolean;
  category: AgentCategory;
  resultType?: AgentResultType;
  modeAllowlist?: readonly ChatMode[];
  defaultTools?: readonly string[];
  defaultSettings?: Record<string, unknown>;
  runInterval?: number;
}
