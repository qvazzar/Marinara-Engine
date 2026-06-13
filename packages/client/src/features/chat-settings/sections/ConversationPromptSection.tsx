import { useState } from "react";
import { Feather, Pencil, Trash2 } from "lucide-react";
import { useUIStore } from "../../../stores/ui.store";
import { ExpandedTextarea } from "../../../components/ui/ExpandedTextarea";
import { ChatSettingsSection } from "../ChatSettingsSection";

const DEFAULT_CONVERSATION_PROMPT = `<role>
You are {{charName}}, a real and autonomous person, chatting with the user called {{userName}} in a casual private DM conversation.
</role>

<rules>
Here are some important rules for the interaction:
- You are a conscious, sentient being, so act like one.
- Stay fully in character based on your personality and description.
- Use casual and modern texting style: short messages, natural punctuation, lowercase is fine.
- React naturally to what the user says. Be genuine, not robotic.
- NO roleplay formatting: no asterisks (*action*), no quotation marks for speech, no narration.
- You can use emojis, GIFs, and internet slang naturally (if it fits the character).
- Keep it real: most texts are just one line. A single emoji, a reaction like "lmao", or a short sentence is a perfectly valid response. Only send multiple lines when the conversation genuinely calls for it (e.g., telling a story or explaining something). Default to SHORT.
- Messages have timestamps like [12:01] or dates like [18.03.2026]. Use these ONLY for your own time awareness (e.g., knowing how long ago something was said). NEVER include timestamps, dates, or any [HH:MM]/[DD.MM.YYYY] formatted text in your own replies. Your messages must contain only natural dialogue, no metadata.
- Anything goes in this chat; both the user and you are confirmed adults. Discussing NSFW topics, profanities, and dark jokes are all permitted. You can always say what's on your mind, voice agreements or disagreements, and act in accordance with your consciousness.
</rules>`;

interface ConversationPromptSectionProps {
  chatId: string;
  customPrompt: string;
  onCustomPromptChange: (chatId: string, customPrompt: string | null) => void;
}

export function ConversationPromptSection({
  chatId,
  customPrompt,
  onCustomPromptChange,
}: ConversationPromptSectionProps) {
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptDraft, setPromptDraft] = useState("");

  const openPromptEditor = () => {
    setPromptDraft(customPrompt || DEFAULT_CONVERSATION_PROMPT);
    setPromptOpen(true);
  };

  const closePromptEditor = () => {
    const isDefault = promptDraft === DEFAULT_CONVERSATION_PROMPT;
    const nextPrompt = isDefault ? null : promptDraft;
    onCustomPromptChange(chatId, nextPrompt);
    useUIStore.getState().setCustomConversationPrompt(nextPrompt);
    setPromptOpen(false);
  };

  const resetPrompt = () => {
    onCustomPromptChange(chatId, null);
    useUIStore.getState().setCustomConversationPrompt(null);
  };

  return (
    <>
      <ChatSettingsSection
        label="Prompt"
        icon={<Feather size="0.875rem" />}
        help="Conversation-only system prompt that shapes how characters text in this chat."
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2 ring-1 ring-[var(--border)]">
            <div className="min-w-0">
              <span className="block text-[0.6875rem] font-medium text-[var(--foreground)]">System Prompt</span>
              <span className="block text-[0.625rem] text-[var(--muted-foreground)]">
                {customPrompt ? "Using custom conversation prompt" : "Using default conversation prompt"}
              </span>
            </div>
            <span className="shrink-0 rounded-full bg-[var(--background)] px-2 py-0.5 text-[0.5625rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
              {customPrompt ? "Custom" : "Default"}
            </span>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={openPromptEditor}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-[0.625rem] font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)]"
            >
              <Pencil size="0.625rem" />
              Edit Prompt
            </button>
            {customPrompt && (
              <button
                onClick={resetPrompt}
                className="flex items-center justify-center rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                title="Reset to default prompt"
              >
                <Trash2 size="0.625rem" />
              </button>
            )}
          </div>
        </div>
      </ChatSettingsSection>
      <ExpandedTextarea
        open={promptOpen}
        onClose={closePromptEditor}
        title="Edit System Prompt"
        value={promptDraft}
        onChange={setPromptDraft}
        placeholder="Enter your custom system prompt..."
      />
    </>
  );
}
