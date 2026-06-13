// ──────────────────────────────────────────────
// Panel: Agents
// ──────────────────────────────────────────────
import { useCallback, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  Sparkles,
  Pencil,
  Plus,
  ChevronDown,
  Trash2,
  Search,
  PenLine,
  Radar,
  Puzzle,
  Camera,
  Download,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useUIStore } from "../../stores/ui.store";
import {
  useAgentConfigs,
  useCreateAgent,
  useDeleteAgent,
  useUploadAgentImage,
  type AgentConfigRow,
} from "../../hooks/use-agents";
import { BUILT_IN_AGENTS, type AgentCategory } from "@marinara-engine/shared";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { downloadJsonFile, sanitizeExportFilenamePart } from "../../lib/download-json";

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseBooleanValue(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true" || value === "1";
  return fallback;
}

function parseAgentSettings(value: unknown): JsonRecord {
  if (isJsonRecord(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return isJsonRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function getAgentImportEntries(parsed: unknown) {
  if (Array.isArray(parsed)) return parsed;
  if (!isJsonRecord(parsed)) return [];
  if (Array.isArray(parsed.agents)) return parsed.agents;
  return [parsed];
}

function serializeAgentConfig(agent: AgentConfigRow) {
  const settings = parseAgentSettings(agent.settings);
  const resultType = typeof settings.resultType === "string" ? settings.resultType : undefined;
  return {
    type: agent.type,
    name: agent.name,
    description: agent.description,
    phase: agent.phase,
    enabled: parseBooleanValue(agent.enabled),
    connectionId: null,
    imagePath: null,
    promptTemplate: agent.promptTemplate,
    settings,
    ...(resultType ? { resultType } : {}),
  };
}

function serializeAgentFolderEntry(agent: AgentConfigRow) {
  const folderName = sanitizeExportFilenamePart(agent.type, "custom-agent");
  return {
    path: `Agents/${folderName}/manifest.json`,
    manifest: {
      kind: "marinara.agent",
      version: 1,
      config: serializeAgentConfig(agent),
    },
  };
}

function normalizeAgentImportEntry(entry: unknown) {
  const container = isJsonRecord(entry) ? entry : null;
  const manifest = container && isJsonRecord(container.manifest) ? container.manifest : container;
  const source = manifest && isJsonRecord(manifest.config) ? manifest.config : manifest;
  if (!isJsonRecord(source)) return null;

  const type = typeof source.type === "string" ? source.type.trim() : "";
  const name = typeof source.name === "string" ? source.name.trim() : "";
  const description = typeof source.description === "string" ? source.description : "";
  const phase =
    source.phase === "pre_generation" || source.phase === "parallel" || source.phase === "post_processing"
      ? source.phase
      : "post_processing";
  if (!type || !name) return null;

  const settings = parseAgentSettings(source.settings);
  const resultType = typeof source.resultType === "string" ? source.resultType : settings.resultType;

  return {
    type,
    name,
    description,
    phase,
    enabled: parseBooleanValue(source.enabled),
    connectionId: typeof source.connectionId === "string" ? source.connectionId : null,
    imagePath: null,
    promptTemplate: typeof source.promptTemplate === "string" ? source.promptTemplate : "",
    settings,
    ...(typeof resultType === "string" ? { resultType } : {}),
  };
}

export function AgentsPanel() {
  const { data: agentConfigs, isLoading } = useAgentConfigs();
  const createAgent = useCreateAgent();
  const deleteAgent = useDeleteAgent();
  const uploadAgentImage = useUploadAgentImage();
  const openAgentDetail = useUIStore((s) => s.openAgentDetail);
  const [agentSearch, setAgentSearch] = useState("");
  const agentImageInputRef = useRef<HTMLInputElement>(null);
  const agentImportInputRef = useRef<HTMLInputElement>(null);
  const imageTargetAgentIdRef = useRef<string | null>(null);
  const [agentImportError, setAgentImportError] = useState<string | null>(null);
  const [agentImportSuccess, setAgentImportSuccess] = useState<string | null>(null);

  // Custom agents = DB entries whose type doesn't match any built-in
  const customAgents = useMemo(
    () =>
      ((agentConfigs ?? []) as AgentConfigRow[]).filter((c) => !BUILT_IN_AGENTS.some((b) => b.id === c.type)),
    [agentConfigs],
  );
  const configByType = useMemo(
    () => new Map(((agentConfigs ?? []) as AgentConfigRow[]).map((config) => [config.type, config])),
    [agentConfigs],
  );

  const agentSearchQuery = agentSearch.trim().toLowerCase();
  const matchesAgentSearch = (agent: { name: string; description: string; category: string }) =>
    !agentSearchQuery ||
    agent.name.toLowerCase().includes(agentSearchQuery) ||
    agent.description.toLowerCase().includes(agentSearchQuery) ||
    agent.category.toLowerCase().includes(agentSearchQuery);
  const agentCategorySections: Array<{ category: AgentCategory; title: string; icon: ReactNode }> = [
    { category: "writer", title: "Writer Agents", icon: <PenLine size="0.8125rem" /> },
    { category: "tracker", title: "Tracker Agents", icon: <Radar size="0.8125rem" /> },
    { category: "misc", title: "Misc Agents", icon: <Puzzle size="0.8125rem" /> },
  ];
  const visibleCustomAgents = customAgents
    .filter((agent) =>
      matchesAgentSearch({
        name: agent.name,
        description: agent.description,
        category: "custom",
      }),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const hasVisibleAgents =
    agentCategorySections.some((section) =>
      BUILT_IN_AGENTS.some((agent) => agent.category === section.category && matchesAgentSearch(agent)),
    ) || visibleCustomAgents.length > 0;

  const handleCreateAgent = () => {
    // Create a new custom agent immediately in DB then open editor
    openAgentDetail("__new__");
  };

  const handleExportAgents = useCallback(() => {
    if (customAgents.length === 0) {
      toast.error("No custom agents to export");
      return;
    }

    downloadJsonFile(
      {
        kind: "marinara.agent-folder",
        version: 1,
        exportedAt: new Date().toISOString(),
        folderName: "Agents",
        agents: customAgents.map(serializeAgentFolderEntry),
      },
      "marinara-agents.json",
    );
    toast.success(`Exported ${customAgents.length} custom agent${customAgents.length === 1 ? "" : "s"}`);
  }, [customAgents]);

  const handleImportAgents = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      setAgentImportError(null);
      setAgentImportSuccess(null);
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const entries = getAgentImportEntries(parsed);
        if (entries.length === 0) throw new Error("No agents found in file");

        let imported = 0;
        const failed: string[] = [];
        for (const entry of entries) {
          const normalized = normalizeAgentImportEntry(entry);
          if (!normalized) continue;
          try {
            await createAgent.mutateAsync(normalized);
            imported++;
          } catch (error) {
            failed.push(error instanceof Error ? error.message : `Failed to import ${normalized.name}`);
          }
        }

        if (imported === 0 && failed.length === 0) {
          throw new Error("No valid agents found in file");
        }
        if (imported > 0) {
          setAgentImportSuccess(`Imported ${imported} agent${imported === 1 ? "" : "s"}.`);
        }
        if (failed.length > 0) {
          setAgentImportError(`${failed.length} agent${failed.length === 1 ? "" : "s"} failed. ${failed[0]}`);
        }
      } catch (error) {
        setAgentImportError(error instanceof Error ? error.message : "Failed to import agents");
      }

      event.target.value = "";
    },
    [createAgent],
  );

  const handlePickAgentImage = useCallback((agentIdOrType: string) => {
    imageTargetAgentIdRef.current = agentIdOrType;
    if (agentImageInputRef.current) {
      agentImageInputRef.current.value = "";
      agentImageInputRef.current.click();
    }
  }, []);

  const handleAgentImageSelected = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      const agentId = imageTargetAgentIdRef.current;
      if (!file || !agentId) return;

      if (!file.type.startsWith("image/")) {
        imageTargetAgentIdRef.current = null;
        toast.error("Choose an image file for the agent picture");
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        const image = typeof reader.result === "string" ? reader.result : "";
        if (!image) {
          toast.error("Could not read that image");
          return;
        }

        try {
          await uploadAgentImage.mutateAsync({ id: agentId, image });
          toast.success("Agent picture updated");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed to upload agent picture");
        } finally {
          imageTargetAgentIdRef.current = null;
        }
      };
      reader.onerror = () => {
        imageTargetAgentIdRef.current = null;
        toast.error("Could not read that image");
      };
      reader.readAsDataURL(file);
    },
    [uploadAgentImage],
  );

  return (
    <div className="flex flex-col gap-2 p-3">
      <input
        ref={agentImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAgentImageSelected}
      />
      <input
        ref={agentImportInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportAgents}
      />

      <div className="flex gap-2">
        <button
          onClick={handleCreateAgent}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-400 to-purple-500 px-3 py-2.5 text-xs font-medium text-white shadow-md shadow-violet-400/15 transition-all hover:shadow-lg hover:shadow-violet-400/25 active:scale-[0.98]"
          title="New"
        >
          <Plus size="0.8125rem" /> <span className="md:hidden">New</span>
        </button>
        <button
          onClick={() => agentImportInputRef.current?.click()}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-xs font-medium text-[var(--secondary-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] active:scale-[0.98]"
          title="Import agents"
        >
          <Download size="0.8125rem" /> <span className="md:hidden">Import</span>
        </button>
        <button
          onClick={handleExportAgents}
          disabled={customAgents.length === 0}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-xs font-medium text-[var(--secondary-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          title="Export custom agents"
        >
          <Upload size="0.8125rem" /> <span className="md:hidden">Export</span>
        </button>
      </div>

      {agentImportError && <div className="rounded-lg bg-red-500/10 px-2 py-1.5 text-xs text-red-500">{agentImportError}</div>}
      {agentImportSuccess && (
        <div className="rounded-lg bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-500">
          {agentImportSuccess}
        </div>
      )}

      <div className="relative">
        <Search
          size="0.8125rem"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
        />
        <input
          value={agentSearch}
          onChange={(event) => setAgentSearch(event.target.value)}
          placeholder="Search agents"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] py-2 pl-8 pr-3 text-xs outline-none transition-colors placeholder:text-[var(--muted-foreground)]/50 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
        />
      </div>

      {isLoading && <div className="py-4 text-center text-xs text-[var(--muted-foreground)]">Loading...</div>}

      {!hasVisibleAgents && (
        <p className="px-1 py-2 text-[0.625rem] text-[var(--muted-foreground)]">No agents match your search.</p>
      )}

      {agentCategorySections.map((section) => {
        const visibleAgents = BUILT_IN_AGENTS.filter(
          (agent) => agent.category === section.category && matchesAgentSearch(agent),
        );
        if (visibleAgents.length === 0 && agentSearchQuery) return null;
        return (
          <PanelSection key={section.category} title={section.title} icon={section.icon}>
            {visibleAgents.length === 0 ? (
              <p className="px-1 py-2 text-[0.625rem] text-[var(--muted-foreground)]">
                No {section.title.toLowerCase()} yet.
              </p>
            ) : (
              visibleAgents.map((agent) =>
                renderAgentCard({
                  id: agent.id,
                  type: agent.id,
                  name: agent.name,
                  description: agent.description,
                  category: agent.category,
                  imagePath: configByType.get(agent.id)?.imagePath ?? null,
                  custom: false,
                  openAgentDetail,
                  onImagePick: () => handlePickAgentImage(agent.id),
                }),
              )
            )}
          </PanelSection>
        );
      })}

      {(visibleCustomAgents.length > 0 || !agentSearchQuery) && (
        <PanelSection title="Custom Agents" icon={<Sparkles size="0.8125rem" />}>
          {visibleCustomAgents.length === 0 ? (
            <p className="px-1 py-2 text-[0.625rem] text-[var(--muted-foreground)]">No custom agents yet</p>
          ) : (
            visibleCustomAgents.map((agent) =>
              renderAgentCard({
                id: agent.id,
                type: agent.type,
                name: agent.name,
                description: agent.description,
                category: "custom",
                imagePath: agent.imagePath ?? null,
                custom: true,
                openAgentDetail,
                onImagePick: () => handlePickAgentImage(agent.id),
                onDelete: async () => {
                  if (
                    await showConfirmDialog({
                      title: "Delete Agent",
                      message: `Delete "${agent.name}"?`,
                      confirmLabel: "Delete",
                      tone: "destructive",
                    })
                  ) {
                    deleteAgent.mutate(agent.id);
                  }
                },
              }),
            )
          )}
        </PanelSection>
      )}
    </div>
  );
}

function renderAgentCard({
  id,
  type,
  name,
  description,
  category,
  imagePath,
  custom,
  openAgentDetail,
  onImagePick,
  onDelete,
}: {
  id: string;
  type: string;
  name: string;
  description: string;
  category: AgentCategory | "custom";
  imagePath?: string | null;
  custom: boolean;
  openAgentDetail: (id: string) => void;
  onImagePick: () => void;
  onDelete?: () => void;
}) {
  const iconContent = imagePath ? (
    <img src={imagePath} alt="" className="h-full w-full object-cover" draggable={false} />
  ) : (
    <Sparkles size="1rem" />
  );
  const iconClasses = cn(
    "relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-white shadow-sm",
    imagePath ? "bg-[var(--muted)]" : "bg-gradient-to-br from-violet-400 to-fuchsia-500",
  );

  return (
    <div
      key={id}
      data-agent-card
      data-agent-name={name}
      className="group relative flex cursor-pointer items-center gap-2.5 rounded-xl p-2 transition-all hover:bg-[var(--sidebar-accent)]"
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onImagePick();
        }}
        className={cn(
          iconClasses,
          "transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-violet-400/50",
        )}
        title={imagePath ? "Replace agent picture" : "Upload agent picture"}
        aria-label={imagePath ? "Replace agent picture" : "Upload agent picture"}
      >
        {iconContent}
        <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
          <Camera size="0.875rem" />
        </span>
      </button>
      <button
        className={cn("min-w-0 flex-1 text-left", onDelete ? "pr-16" : "pr-10")}
        onClick={() => openAgentDetail(custom ? id : type)}
      >
        <div className="truncate text-sm font-medium">{name}</div>
        <div className="mt-0.5 text-[0.625rem] text-[var(--muted-foreground)] line-clamp-2">
          {description || "No description"}
        </div>
        <div className="mt-1 text-[0.5625rem] uppercase text-[var(--muted-foreground)]/80">
          {custom ? "custom" : category}
        </div>
      </button>
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 shrink-0 items-center gap-0.5 rounded-lg bg-[var(--sidebar)] px-1 py-0.5 opacity-0 shadow-sm ring-1 ring-[var(--border)] transition-opacity group-hover:opacity-100 max-md:opacity-100">
        <button
          className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-all hover:bg-violet-400/10 hover:text-violet-400 active:scale-90"
          title="Edit agent"
          onClick={(event) => {
            event.stopPropagation();
            openAgentDetail(custom ? id : type);
          }}
        >
          <Pencil size="0.75rem" />
        </button>
        {onDelete && (
          <button
            className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-all hover:bg-[var(--destructive)]/15 active:scale-90"
            title="Delete agent"
            onClick={(event) => {
              event.stopPropagation();
              void onDelete();
            }}
          >
            <Trash2 size="0.75rem" className="text-[var(--destructive)]" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Collapsible section ──
function PanelSection({
  title,
  icon,
  action,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mt-1">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 px-1 py-1 text-left text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]"
        >
          <ChevronDown
            size="0.75rem"
            className={cn("text-[var(--muted-foreground)] transition-transform", open && "rotate-180")}
          />
          <span className="text-violet-400">{icon}</span>
          {title}
        </button>
        {action}
      </div>
      {open && <div className="mt-1 flex flex-col gap-1">{children}</div>}
    </div>
  );
}
