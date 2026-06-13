import { MessageSquare } from "lucide-react";
import { cn } from "../../../lib/utils";
import { ChatSettingsSection } from "../ChatSettingsSection";

interface ContextLimitSectionProps {
  contextMessageLimit: number | null | undefined;
  excludePastReasoning: boolean | undefined;
  onContextMessageLimitChange: (value: number | null) => void;
  onExcludePastReasoningChange: (value: boolean) => void;
}

export function ContextLimitSection({
  contextMessageLimit,
  excludePastReasoning,
  onContextMessageLimitChange,
  onExcludePastReasoningChange,
}: ContextLimitSectionProps) {
  const excludeReasoningEnabled = excludePastReasoning !== false;

  return (
    <ChatSettingsSection
      label="Context Limit"
      icon={<MessageSquare size="0.875rem" />}
      help="Limit how many messages are included in the context sent to the AI model. When off, all messages are sent (up to the model's context window). When on, only the last N messages are included."
    >
      <div className="space-y-2">
        <button
          onClick={() => {
            if (contextMessageLimit) {
              onContextMessageLimitChange(null);
            } else {
              onContextMessageLimitChange(50);
            }
          }}
          className={cn(
            "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
            contextMessageLimit
              ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
              : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
          )}
        >
          <div>
            <span className="text-xs font-medium">Limit Context Messages</span>
            <p className="text-[0.625rem] text-[var(--muted-foreground)]">
              Only send the last N messages to the model
            </p>
          </div>
          <div
            className={cn(
              "h-5 w-9 overflow-hidden rounded-full p-0.5 transition-colors",
              contextMessageLimit ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
            )}
          >
            <div
              className={cn(
                "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                contextMessageLimit && "translate-x-3.5",
              )}
            />
          </div>
        </button>
        {contextMessageLimit && (
          <div className="flex items-center gap-2 px-1">
            <input
              type="number"
              min={1}
              max={9999}
              value={contextMessageLimit}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val > 0) {
                  onContextMessageLimitChange(val);
                }
              }}
              className="w-20 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
            />
            <span className="text-[0.625rem] text-[var(--muted-foreground)]">messages</span>
          </div>
        )}
        <button
          onClick={() => onExcludePastReasoningChange(!excludeReasoningEnabled)}
          className={cn(
            "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
            excludeReasoningEnabled
              ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
              : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
          )}
        >
          <div>
            <span className="text-xs font-medium">Exclude Past Reasoning</span>
            <p className="text-[0.625rem] text-[var(--muted-foreground)]">
              Keep stored thinking/reasoning metadata out of future prompts.
            </p>
          </div>
          <div
            className={cn(
              "h-5 w-9 overflow-hidden rounded-full p-0.5 transition-colors",
              excludeReasoningEnabled ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
            )}
          >
            <div
              className={cn(
                "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                excludeReasoningEnabled && "translate-x-3.5",
              )}
            />
          </div>
        </button>
      </div>
    </ChatSettingsSection>
  );
}
