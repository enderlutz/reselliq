import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Plus,
  Trash2,
  Search,
  Eye,
  Pencil,
  Loader2,
  X,
  Calendar,
  Hash,
} from "lucide-react";
import { api } from "@/lib/api";
import type { JournalEntry, JournalTag } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtRelativeTime(iso: string) {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return fmtDate(iso);
}

function parseTags(s: string): string[] {
  return s
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

export default function Journal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [tags, setTags] = useState<JournalTag[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string>("");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [draft, setDraft] = useState({
    title: "",
    entry_date: "",
    tags: "",
    content_md: "",
  });
  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string>("");

  // Reload entries (with optional filters)
  async function reload() {
    const params: Record<string, string> = {};
    if (searchQuery) params.q = searchQuery;
    if (activeTag) params.tag = activeTag;
    const r = await api.get<JournalEntry[]>("/journal", { params });
    setEntries(r.data);
    if (r.data.length && activeId == null) {
      selectEntry(r.data[0]);
    }
  }

  async function reloadTags() {
    const r = await api.get<JournalTag[]>("/journal/tags");
    setTags(r.data);
  }

  useEffect(() => {
    reload();
    reloadTags();
  }, []);

  useEffect(() => {
    const t = setTimeout(reload, 200);
    return () => clearTimeout(t);
  }, [searchQuery, activeTag]);

  function selectEntry(e: JournalEntry) {
    setActiveId(e.id);
    setDraft({
      title: e.title,
      entry_date: e.entry_date,
      tags: e.tags,
      content_md: e.content_md,
    });
    setPreviewMode(false);
    setSavedAt(e.updated_at);
  }

  async function newEntry() {
    const today = new Date().toISOString().slice(0, 10);
    const r = await api.post<JournalEntry>("/journal", {
      title: "Untitled",
      entry_date: today,
      content_md: "",
      tags: "",
    });
    setEntries((prev) => [r.data, ...prev]);
    selectEntry(r.data);
    reloadTags();
  }

  async function persistDraft(showSpinner = true) {
    if (activeId == null) return;
    if (showSpinner) setSaving(true);
    try {
      const r = await api.patch<JournalEntry>(`/journal/${activeId}`, draft);
      setEntries((prev) => prev.map((e) => (e.id === r.data.id ? r.data : e)));
      setSavedAt(r.data.updated_at);
      reloadTags();
    } finally {
      if (showSpinner) setSaving(false);
    }
  }

  // Debounced auto-save when draft changes
  const draftSig = `${draft.title}|${draft.entry_date}|${draft.tags}|${draft.content_md}`;
  const lastSavedSig = useRef("");
  useEffect(() => {
    if (activeId == null) return;
    if (draftSig === lastSavedSig.current) return;
    const t = setTimeout(() => {
      persistDraft(false).then(() => (lastSavedSig.current = draftSig));
    }, 800);
    return () => clearTimeout(t);
  }, [draftSig, activeId]);

  async function deleteEntry() {
    if (activeId == null) return;
    if (!confirm("Delete this entry? Cannot be undone.")) return;
    await api.delete(`/journal/${activeId}`);
    setEntries((prev) => prev.filter((e) => e.id !== activeId));
    setActiveId(null);
    setDraft({ title: "", entry_date: "", tags: "", content_md: "" });
    reloadTags();
  }

  const draftTags = useMemo(() => parseTags(draft.tags), [draft.tags]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Journal"
        subtitle="Your personal diary of flips, lessons, and observations. Markdown supported."
        actions={
          <Button onClick={newEntry}>
            <Plus className="h-4 w-4" />
            New entry
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 h-[calc(100vh-260px)] min-h-[500px]">
        {/* List column */}
        <Card className="flex flex-col overflow-hidden">
          <div className="p-3 border-b border-white/5 space-y-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search entries…"
                className="pl-9 h-8 text-sm"
              />
            </div>
            {tags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {activeTag && (
                  <button
                    onClick={() => setActiveTag("")}
                    className="text-[10px] uppercase tracking-wider text-[hsl(var(--chip-cyan))] hover:underline flex items-center gap-1"
                  >
                    <X className="h-3 w-3" /> clear filter
                  </button>
                )}
                {tags.slice(0, 8).map((t) => (
                  <button
                    key={t.tag}
                    onClick={() => setActiveTag(activeTag === t.tag ? "" : t.tag)}
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors",
                      activeTag === t.tag
                        ? "bg-[hsl(var(--chip-cyan)/0.15)] border-[hsl(var(--chip-cyan)/0.4)] text-[hsl(var(--chip-cyan))]"
                        : "bg-white/[0.02] border-white/10 text-muted-foreground hover:border-white/20"
                    )}
                  >
                    #{t.tag} <span className="opacity-60">{t.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {entries.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {searchQuery || activeTag ? "No entries match." : "No entries yet — click New entry to start."}
              </div>
            ) : (
              <ul>
                {entries.map((e) => {
                  const tagList = parseTags(e.tags);
                  const preview = e.content_md.replace(/[#*`_>]/g, "").slice(0, 90);
                  return (
                    <li key={e.id}>
                      <button
                        onClick={() => selectEntry(e)}
                        className={cn(
                          "w-full text-left px-4 py-3 border-b border-white/5 transition-colors",
                          activeId === e.id
                            ? "bg-white/[0.05]"
                            : "hover:bg-white/[0.02]"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="font-medium text-sm truncate flex-1">
                            {e.title || "Untitled"}
                          </div>
                          <div className="text-[10px] text-muted-foreground tabular shrink-0">
                            {fmtDate(e.entry_date)}
                          </div>
                        </div>
                        {preview && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {preview}
                          </p>
                        )}
                        {tagList.length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {tagList.slice(0, 4).map((t) => (
                              <span
                                key={t}
                                className="text-[9px] uppercase tracking-wider text-muted-foreground/80"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        {/* Editor column */}
        <Card className="flex flex-col overflow-hidden">
          {activeId == null ? (
            <div className="flex-1 flex items-center justify-center text-center text-sm text-muted-foreground p-8">
              <div>
                <p>Select an entry to view or edit.</p>
                <p className="mt-2">Or click <strong className="text-foreground">+ New entry</strong> to start a fresh log.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header row: title, date, tags, actions */}
              <div className="p-4 border-b border-white/5 space-y-3">
                <Input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Title"
                  className="h-9 text-base font-semibold border-transparent bg-transparent px-0 focus-visible:ring-0 shadow-none"
                />
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <input
                      type="date"
                      value={draft.entry_date}
                      onChange={(e) => setDraft({ ...draft, entry_date: e.target.value })}
                      className="bg-transparent border-none text-xs focus:outline-none text-foreground tabular"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-1 min-w-[200px]">
                    <Hash className="h-3.5 w-3.5" />
                    <input
                      type="text"
                      value={draft.tags}
                      onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                      placeholder="comma, separated, tags"
                      className="bg-transparent border-none text-xs focus:outline-none text-foreground flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant={previewMode ? "default" : "outline"}
                      onClick={() => setPreviewMode((p) => !p)}
                    >
                      {previewMode ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {previewMode ? "Edit" : "Preview"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={deleteEntry}
                      title="Delete entry"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {draftTags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {draftTags.map((t) => (
                      <Badge key={t} variant="info" className="text-[10px]">
                        #{t}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto">
                {previewMode ? (
                  <div className="p-6">
                    {draft.content_md.trim() ? (
                      <div className="prose-playbook">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {draft.content_md}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Empty entry. Switch to Edit to write.</p>
                    )}
                  </div>
                ) : (
                  <Textarea
                    value={draft.content_md}
                    onChange={(e) => setDraft({ ...draft, content_md: e.target.value })}
                    placeholder={`# Pokemon 151 ETB flip — what happened\n\nGot 2x ETBs at Target Drive-Up. Sold one on eBay for $74, kept one for the collection.\n\n## What worked\n- Aged account + Drive-up = no cancel\n- Listed within 12hr of acquiring\n\n## What I'd do differently\n- ...`}
                    className="border-none rounded-none resize-none h-full min-h-[400px] font-mono text-sm bg-transparent shadow-none focus-visible:ring-0"
                  />
                )}
              </div>

              {/* Save indicator */}
              <div className="px-4 py-2 border-t border-white/5 text-[11px] text-muted-foreground flex items-center justify-between">
                <span>
                  {saving ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" /> saving…
                    </span>
                  ) : (
                    <>auto-saves on edit · last saved {savedAt ? fmtRelativeTime(savedAt) : "—"}</>
                  )}
                </span>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
