import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, Save, Pencil, NotebookPen } from "lucide-react";
import { api } from "@/lib/api";
import type { Playbook } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const ALL_TAB = "__all__";

interface ParsedMd {
  intro: string;
  sections: { title: string; body: string }[];
}

/**
 * Parse curated_md by H2 (`## ...`) headers.
 * - Intro = everything before the first H2
 * - Each H2 + its body becomes a tab
 */
function parseSections(md: string): ParsedMd {
  const lines = md.split("\n");
  const intro: string[] = [];
  const sections: { title: string; body: string[] }[] = [];
  let cur: { title: string; body: string[] } | null = null;
  for (const line of lines) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      if (cur) sections.push(cur);
      cur = { title: m[1], body: [] };
    } else if (cur) {
      cur.body.push(line);
    } else {
      intro.push(line);
    }
  }
  if (cur) sections.push(cur);
  return {
    intro: intro.join("\n").trim(),
    sections: sections.map((s) => ({ title: s.title, body: s.body.join("\n").trim() })),
  };
}

function MarkdownView({ children }: { children: string }) {
  return (
    <div className="prose-playbook">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

export default function PlaybookPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [activeKey, setActiveKey] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Playbook[]>("/playbook").then((r) => {
      setPlaybooks(r.data);
      if (!activeKey && r.data.length > 0) setActiveKey(r.data[0].retailer_key);
    });
  }, []);

  const active = useMemo(
    () => playbooks.find((p) => p.retailer_key === activeKey) || null,
    [playbooks, activeKey]
  );

  const parsed = useMemo<ParsedMd>(() => {
    if (!active) return { intro: "", sections: [] };
    return parseSections(active.curated_md);
  }, [active?.id]);

  useEffect(() => {
    setNotesDraft(active?.user_notes_md || "");
    setEditingNotes(false);
    setActiveTab(ALL_TAB);
  }, [active?.id]);

  async function saveNotes() {
    if (!active) return;
    setSaving(true);
    try {
      const r = await api.patch<Playbook>(`/playbook/${active.retailer_key}`, {
        user_notes_md: notesDraft,
      });
      setPlaybooks((prev) =>
        prev.map((p) => (p.retailer_key === r.data.retailer_key ? r.data : p))
      );
      setEditingNotes(false);
    } finally {
      setSaving(false);
    }
  }

  // Show tabs only when there are 2+ sections (otherwise just render raw)
  const showTabs = parsed.sections.length >= 2;
  const selected =
    activeTab === ALL_TAB
      ? null
      : parsed.sections.find((s) => s.title === activeTab) || null;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Playbook"
        subtitle="How retailers detect bots & cancel orders — so legitimate buys don't get caught in the crossfire."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
        {/* Sidebar — playbook entries */}
        <Card className="p-2 self-start sticky top-2">
          <nav className="space-y-1">
            {playbooks.map((p) => (
              <button
                key={p.retailer_key}
                onClick={() => setActiveKey(p.retailer_key)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                  p.retailer_key === activeKey
                    ? "bg-white/[0.06] text-foreground"
                    : "text-muted-foreground hover:bg-white/[0.03] hover:text-foreground"
                )}
              >
                <div className="font-medium leading-tight">
                  {p.title.split(" — ")[0]}
                </div>
                {p.summary && (
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {p.summary}
                  </div>
                )}
              </button>
            ))}
          </nav>
        </Card>

        {/* Main */}
        <div className="space-y-5">
          {!active ? (
            <Card className="p-12 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            </Card>
          ) : (
            <>
              <Card className="p-6">
                <h2 className="text-2xl font-bold tracking-tight mb-2">
                  {active.title}
                </h2>
                {active.summary && (
                  <p className="text-sm text-muted-foreground mb-5 italic">
                    {active.summary}
                  </p>
                )}

                {/* Intro (always shown) */}
                {parsed.intro && (
                  <div className="mb-5">
                    <MarkdownView>{parsed.intro}</MarkdownView>
                  </div>
                )}

                {/* Tab strip */}
                {showTabs && (
                  <div className="flex flex-wrap gap-1.5 mb-5 -mx-1 px-1 pb-3 border-b border-white/5">
                    <TabButton
                      label="All"
                      active={activeTab === ALL_TAB}
                      onClick={() => setActiveTab(ALL_TAB)}
                    />
                    {parsed.sections.map((s) => (
                      <TabButton
                        key={s.title}
                        label={s.title}
                        active={activeTab === s.title}
                        onClick={() => setActiveTab(s.title)}
                      />
                    ))}
                  </div>
                )}

                {/* Section content */}
                {showTabs ? (
                  selected ? (
                    <MarkdownView>{`## ${selected.title}\n\n${selected.body}`}</MarkdownView>
                  ) : (
                    <MarkdownView>
                      {parsed.sections
                        .map((s) => `## ${s.title}\n\n${s.body}`)
                        .join("\n\n")}
                    </MarkdownView>
                  )
                ) : (
                  parsed.sections.length === 1 && (
                    <MarkdownView>{`## ${parsed.sections[0].title}\n\n${parsed.sections[0].body}`}</MarkdownView>
                  )
                )}
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <NotebookPen className="h-4 w-4 text-[hsl(var(--chip-orange))]" />
                    Your notes
                  </h3>
                  {!editingNotes ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingNotes(true)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setNotesDraft(active.user_notes_md || "");
                          setEditingNotes(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button size="sm" onClick={saveNotes} disabled={saving}>
                        {saving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        Save
                      </Button>
                    </div>
                  )}
                </div>

                {editingNotes ? (
                  <Textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    rows={12}
                    placeholder={`# Cancellations & lessons\n\n## 2026-XX-XX — Target\nGot cancelled on 5x ETB ship-to-home. Probably velocity. Switched to drive-up next time = success.\n\n## 2026-XX-XX — Walmart\n…`}
                    className="font-mono text-xs"
                  />
                ) : active.user_notes_md ? (
                  <MarkdownView>{active.user_notes_md}</MarkdownView>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No notes yet. Click <em>Edit</em> to log cancellations, lessons,
                    or retailer-specific patterns you observe over time. Markdown
                    supported.
                  </p>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
        active
          ? "bg-[hsl(var(--chip-cyan)/0.18)] text-[hsl(var(--chip-cyan))] border border-[hsl(var(--chip-cyan)/0.3)]"
          : "bg-white/[0.02] text-muted-foreground hover:bg-white/[0.05] hover:text-foreground border border-white/5"
      )}
    >
      {label}
    </button>
  );
}
