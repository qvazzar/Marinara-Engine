import type { BuiltInAgentManifest } from "./agent-manifest.types.js";
import { autonomousMessengerAgentManifest } from "./autonomous-messenger/manifest.js";
import { backgroundAgentManifest } from "./background/manifest.js";
import { cardEvolutionAuditorAgentManifest } from "./card-evolution-auditor/manifest.js";
import { characterTrackerAgentManifest } from "./character-tracker/manifest.js";
import { chatSummaryAgentManifest } from "./chat-summary/manifest.js";
import { combatAgentManifest } from "./combat/manifest.js";
import { continuityAgentManifest } from "./continuity/manifest.js";
import { customTrackerAgentManifest } from "./custom-tracker/manifest.js";
import { cyoaAgentManifest } from "./cyoa/manifest.js";
import { directorAgentManifest } from "./director/manifest.js";
import { echoChamberAgentManifest } from "./echo-chamber/manifest.js";
import { editorAgentManifest } from "./editor/manifest.js";
import { expressionAgentManifest } from "./expression/manifest.js";
import { hapticAgentManifest } from "./haptic/manifest.js";
import { htmlAgentManifest } from "./html/manifest.js";
import { illustratorAgentManifest } from "./illustrator/manifest.js";
import { knowledgeRetrievalAgentManifest } from "./knowledge-retrieval/manifest.js";
import { knowledgeRouterAgentManifest } from "./knowledge-router/manifest.js";
import { lorebookKeeperAgentManifest } from "./lorebook-keeper/manifest.js";
import { personaStatsAgentManifest } from "./persona-stats/manifest.js";
import { promptReviewerAgentManifest } from "./prompt-reviewer/manifest.js";
import { proseGuardianAgentManifest } from "./prose-guardian/manifest.js";
import { questAgentManifest } from "./quest/manifest.js";
import { responseOrchestratorAgentManifest } from "./response-orchestrator/manifest.js";
import { schedulePlannerAgentManifest } from "./schedule-planner/manifest.js";
import { secretPlotDriverAgentManifest } from "./secret-plot-driver/manifest.js";
import { spotifyAgentManifest } from "./spotify/manifest.js";
import { worldStateAgentManifest } from "./world-state/manifest.js";

export const BUILT_IN_AGENT_MANIFESTS: readonly BuiltInAgentManifest[] = [
  proseGuardianAgentManifest,
  continuityAgentManifest,
  directorAgentManifest,
  echoChamberAgentManifest,
  promptReviewerAgentManifest,
  worldStateAgentManifest,
  expressionAgentManifest,
  questAgentManifest,
  backgroundAgentManifest,
  characterTrackerAgentManifest,
  personaStatsAgentManifest,
  customTrackerAgentManifest,
  illustratorAgentManifest,
  lorebookKeeperAgentManifest,
  cardEvolutionAuditorAgentManifest,
  combatAgentManifest,
  htmlAgentManifest,
  chatSummaryAgentManifest,
  spotifyAgentManifest,
  editorAgentManifest,
  knowledgeRetrievalAgentManifest,
  knowledgeRouterAgentManifest,
  schedulePlannerAgentManifest,
  responseOrchestratorAgentManifest,
  autonomousMessengerAgentManifest,
  hapticAgentManifest,
  cyoaAgentManifest,
  secretPlotDriverAgentManifest,
];

export function getBuiltInAgentManifest(agentId: string): BuiltInAgentManifest | null {
  return BUILT_IN_AGENT_MANIFESTS.find((agent) => agent.id === agentId) ?? null;
}
