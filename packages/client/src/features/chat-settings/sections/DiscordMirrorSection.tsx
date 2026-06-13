import { Globe } from "lucide-react";
import { ChatSettingsSection } from "../ChatSettingsSection";

interface DiscordMirrorSectionProps {
  webhookUrl: string;
  onWebhookUrlChange: (webhookUrl: string) => void;
}

export function DiscordMirrorSection({ webhookUrl, onWebhookUrlChange }: DiscordMirrorSectionProps) {
  const trimmedWebhookUrl = webhookUrl.trim();
  const hasInvalidWebhook =
    trimmedWebhookUrl.length > 0 && !/^https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(trimmedWebhookUrl);

  return (
    <ChatSettingsSection
      label="Discord Mirror"
      icon={<Globe size="0.875rem" />}
      help="Mirror messages from this chat to a Discord channel via webhook. Character messages appear under the character's name, and Game mode system narration uses narrator-style labels where needed."
    >
      <div className="space-y-2">
        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
          Paste a Discord webhook URL to mirror this chat's messages to a channel. Character messages appear under their
          name, and game narration/party messages use simple speaker labels.
        </p>
        <input
          type="url"
          placeholder="https://discord.com/api/webhooks/..."
          value={webhookUrl}
          onChange={(e) => onWebhookUrlChange(e.target.value.trim())}
          className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2.5 text-[0.6875rem] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50 ring-1 ring-transparent focus:ring-[var(--primary)]/40 focus:outline-none transition-all"
        />
        {hasInvalidWebhook && <p className="text-[0.625rem] text-red-400">Invalid webhook URL format</p>}
      </div>
    </ChatSettingsSection>
  );
}
