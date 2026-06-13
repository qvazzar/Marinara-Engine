import { Feather, Maximize2 } from "lucide-react";
import { ExpandedTextarea } from "../../../components/ui/ExpandedTextarea";
import { ChatSettingsSection } from "../ChatSettingsSection";

interface GameExtraPromptSectionProps {
  expanded: boolean;
  storedValue: string;
  value: string;
  onCommit: (value: string | null) => void;
  onExpandedChange: (expanded: boolean) => void;
  onValueChange: (value: string) => void;
}

export function GameExtraPromptSection({
  expanded,
  storedValue,
  value,
  onCommit,
  onExpandedChange,
  onValueChange,
}: GameExtraPromptSectionProps) {
  const commitIfChanged = (nextFocusTarget?: EventTarget | null) => {
    if ((nextFocusTarget as HTMLElement | null)?.closest?.("[data-skip-blur-commit='true']")) return;
    if (value !== storedValue) onCommit(value || null);
  };

  return (
    <ChatSettingsSection
      label="Extra Prompt"
      icon={<Feather size="0.875rem" />}
      help="Additional instructions added to game generation prompts. Use this to suggest a writing style, ban themes, request specific behaviors, etc. Does not affect scene analysis."
    >
      <div className="space-y-1.5">
        <div className="relative">
          <textarea
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            onBlur={(event) => commitIfChanged(event.relatedTarget)}
            placeholder="e.g. Write in a poetic, literary style. Avoid graphic violence. Always describe the weather..."
            rows={5}
            className="w-full resize-y rounded-lg bg-[var(--secondary)] px-3 py-2 pr-8 text-xs leading-relaxed outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
          />
          <button
            type="button"
            aria-label="Expand extra prompt editor"
            data-skip-blur-commit="true"
            onClick={() => onExpandedChange(true)}
            className="absolute right-1.5 top-1.5 rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            title="Expand editor"
          >
            <Maximize2 size="0.75rem" />
          </button>
        </div>
        <p className="text-[0.5625rem] text-[var(--muted-foreground)]/70 px-0.5">
          {value ? "Custom instructions active" : "No extra instructions set"}
        </p>
        {value && (
          <button
            type="button"
            data-skip-blur-commit="true"
            onClick={() => {
              onValueChange("");
              onCommit(null);
            }}
            className="rounded-lg bg-[var(--secondary)] px-2.5 py-1 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)]"
          >
            Clear
          </button>
        )}
      </div>
      <ExpandedTextarea
        open={expanded}
        onClose={() => {
          onExpandedChange(false);
          commitIfChanged(null);
        }}
        title="Extra Prompt"
        value={value}
        onChange={onValueChange}
        placeholder="Additional instructions for game generation..."
      />
    </ChatSettingsSection>
  );
}
