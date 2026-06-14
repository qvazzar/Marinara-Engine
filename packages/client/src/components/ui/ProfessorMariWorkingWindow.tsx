import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";

const DOTTOR_SUPPORT_GIF = "/sprites/dottore/dottore_jumping.gif";

interface ProfessorMariWorkingWindowProps {
  visible: boolean;
  className?: string;
}

export function ProfessorMariWorkingWindow({ visible, className }: ProfessorMariWorkingWindowProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (visible) {
      setImageFailed(false);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "grid grid-cols-[2.25rem_minmax(0,1fr)] gap-2",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex min-w-0 justify-start pt-0.5">
        <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg border border-[var(--border)]/70 bg-[var(--card)] shadow-sm">
          {!imageFailed && (
            <img
              src={DOTTOR_SUPPORT_GIF}
              alt=""
              className="h-7 w-7 object-contain [image-rendering:pixelated]"
              onError={() => setImageFailed(true)}
            />
          )}
        </span>
      </div>
      <div className="inline-flex max-w-full items-center gap-3 overflow-hidden rounded-lg border border-[var(--border)]/70 bg-[var(--card)]/70 px-3 py-2 text-[var(--foreground)] shadow-sm">
        {!imageFailed && (
          <img
            src={DOTTOR_SUPPORT_GIF}
            alt="Dottore doing jumping jacks while Professor Mari works"
            className="h-16 w-16 shrink-0 object-contain [image-rendering:pixelated]"
            onError={() => setImageFailed(true)}
          />
        )}
        <p className="min-w-0 text-xs font-medium leading-relaxed text-[var(--foreground)]">
          Professor Mari is working. Dottore is doing jumping jacks for moral support...
        </p>
      </div>
    </div>
  );
}
