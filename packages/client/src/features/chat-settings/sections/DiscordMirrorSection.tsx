import { useId } from "react";
import { Globe } from "lucide-react";

interface DiscordMirrorControlsProps {
  webhookUrl: string;
  onWebhookUrlChange: (webhookUrl: string) => void;
}

export function DiscordMirrorControls({ webhookUrl, onWebhookUrlChange }: DiscordMirrorControlsProps) {
  const webhookInputId = useId();
  const webhookErrorId = useId();
  const trimmedWebhookUrl = webhookUrl.trim();
  const hasInvalidWebhook =
    trimmedWebhookUrl.length > 0 && !/^https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(trimmedWebhookUrl);

  return (
    <div className="space-y-2 border-t border-[var(--border)]/70 pt-2.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        <Globe size="0.75rem" className="text-[var(--muted-foreground)]" />
        <span>Discord Mirror</span>
      </div>
      <p className="text-[0.625rem] text-[var(--muted-foreground)]">
        Paste a Discord webhook URL to mirror this chat's messages to a channel. Character messages appear under their
        name, and game narration/party messages use simple speaker labels.
      </p>
      <input
        id={webhookInputId}
        type="url"
        placeholder="https://discord.com/api/webhooks/..."
        value={webhookUrl}
        onChange={(e) => onWebhookUrlChange(e.target.value.trim())}
        aria-invalid={hasInvalidWebhook}
        aria-describedby={hasInvalidWebhook ? webhookErrorId : undefined}
        className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2.5 text-[0.6875rem] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50 ring-1 ring-transparent focus:ring-[var(--primary)]/40 focus:outline-none transition-all"
      />
      {hasInvalidWebhook && (
        <p id={webhookErrorId} className="text-[0.625rem] text-red-400">
          Invalid webhook URL format
        </p>
      )}
    </div>
  );
}
