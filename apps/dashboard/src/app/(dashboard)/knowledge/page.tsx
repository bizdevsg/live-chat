"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Send } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { ConfirmModal, Modal } from "@/components/ui/modal";
import { Input, Select, Textarea } from "@/components/ui/input";
import { useAuthStore } from "@/lib/auth-store";
import { isSuperAdminRole } from "@/lib/is-super-admin";

type MarkdownPreviewProps = {
  source: string;
};

const MarkdownPreview = dynamic(
  () =>
    import("@uiw/react-md-editor").then(
      (mod) => (mod.default as unknown as { Markdown: ComponentType<MarkdownPreviewProps> }).Markdown,
    ),
  { ssr: false },
);

interface Category {
  id: string;
  name: string;
}

interface KnowledgeDoc {
  id: string;
  title: string;
  summary?: string | null;
  status: string;
  audience: string;
  version: number;
  updatedAt: string;
  category?: Category | null;
}

interface AiKnowledgeTestResult {
  site: {
    id: string;
    name: string;
    aiName: string;
    language: string;
    organizationName: string;
  };
  classification: {
    intent: string;
    confidence: number;
    sentiment: string;
    containsSensitiveData: boolean;
    promptInjectionDetected: boolean;
  };
  retrievalQuery: string;
  forcedHandoffReason: string | null;
  evidence: Array<{
    index: number;
    sourceType: "KNOWLEDGE" | "MARKET";
    documentId: string;
    chunkId: string;
    title: string;
    version: number;
    audience: string;
    content: string;
  }>;
  answer: {
    answer: string;
    formattedAnswer: string;
    confidence: number;
    intent: string;
    handoffRequired: boolean;
    handoffReason?: string;
    lowConfidence: boolean;
    wouldAutoHandoff: boolean;
    sources: Array<{
      documentId: string;
      chunkId: string;
      title: string;
      version: number;
      score: number;
    }>;
  } | null;
}

const STATUS_TONE: Record<string, "neutral" | "gold" | "green" | "red" | "amber" | "blue"> = {
  ACTIVE: "green",
  NON_ACTIVE: "neutral",
};

const KNOWLEDGE_PREVIEW_STORAGE_KEY = "solidchat_dashboard_knowledge_preview";
const PREVIEW_SAMPLE_MESSAGE = "Berapa minimal deposit akun mini dan apakah ada rollover fee?";

interface KnowledgePreviewMessage {
  id: string;
  role: "VISITOR" | "AI" | "SYSTEM";
  content: string;
  createdAt: string;
  pending?: boolean;
  error?: boolean;
  result?: AiKnowledgeTestResult | null;
}

interface StoredKnowledgePreviewState {
  draft: string;
  messages: KnowledgePreviewMessage[];
  selectedMessageId: string | null;
}

function readKnowledgePreviewState(): StoredKnowledgePreviewState {
  if (typeof window === "undefined") {
    return { draft: "", messages: [], selectedMessageId: null };
  }

  const raw = window.localStorage.getItem(KNOWLEDGE_PREVIEW_STORAGE_KEY);
  if (!raw) {
    return { draft: "", messages: [], selectedMessageId: null };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredKnowledgePreviewState>;
    return {
      draft: typeof parsed.draft === "string" ? parsed.draft : "",
      messages: Array.isArray(parsed.messages) ? parsed.messages.filter((message) => !message.pending) : [],
      selectedMessageId: typeof parsed.selectedMessageId === "string" ? parsed.selectedMessageId : null,
    };
  } catch {
    return { draft: "", messages: [], selectedMessageId: null };
  }
}

function truncateEvidence(content: string, maxLength = 240) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function formatPreviewTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getPreviewGreeting(aiName?: string) {
  return `Halo! Saya ${aiName ?? "AI Preview"}, siap bantu menguji knowledge base Anda.`;
}

export default function KnowledgePage() {
  const [status, setStatus] = useState("");
  const [audience, setAudience] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewEndRef = useRef<HTMLDivElement>(null);
  const [deletingDoc, setDeletingDoc] = useState<KnowledgeDoc | null>(null);
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const previewStateRef = useRef<StoredKnowledgePreviewState>(readKnowledgePreviewState());
  const [testMessage, setTestMessage] = useState(previewStateRef.current.draft);
  const [previewMessages, setPreviewMessages] = useState<KnowledgePreviewMessage[]>(previewStateRef.current.messages);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(previewStateRef.current.selectedMessageId);
  const isSuperAdmin = isSuperAdminRole(user?.roles);

  const categories = useQuery({
    queryKey: ["knowledge-categories"],
    queryFn: () => apiClient.get<Category[]>("/api/v1/knowledge/categories"),
  });

  const overview = useQuery({
    queryKey: ["knowledge-overview"],
    queryFn: () => apiClient.get<{ items: KnowledgeDoc[] }>("/api/v1/knowledge/documents?pageSize=200"),
  });

  const query = useQuery({
    queryKey: ["knowledge", status, audience, categoryId, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (audience) params.set("audience", audience);
      if (categoryId) params.set("categoryId", categoryId);
      if (search.trim()) params.set("search", search.trim());
      const suffix = params.toString() ? `?${params.toString()}` : "";
      return apiClient.get<{ items: KnowledgeDoc[] }>(`/api/v1/knowledge/documents${suffix}`);
    },
  });

  const upload = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiClient.upload("/api/v1/knowledge/upload", formData);
    },
    onSuccess: () => {
      toast.push("Dokumen markdown berhasil diunggah sebagai NON_ACTIVE.", "success");
      queryClient.invalidateQueries({ queryKey: ["knowledge"] });
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal mengunggah dokumen.", "error"),
  });

  const removeArticle = useMutation({
    mutationFn: (id: string) => apiClient.delete<{ id: string }>(`/api/v1/knowledge/documents/${id}`),
    onSuccess: () => {
      toast.push("Artikel dihapus.", "success");
      queryClient.invalidateQueries({ queryKey: ["knowledge"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-overview"] });
      setDeletingDoc(null);
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal menghapus artikel.", "error"),
  });
  const toggleStatus = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: "ACTIVE" | "NON_ACTIVE" }) =>
      apiClient.post(
        `/api/v1/knowledge/documents/${id}/${nextStatus === "ACTIVE" ? "activate" : "deactivate"}`,
      ),
    onMutate: ({ id }) => {
      setPendingToggleId(id);
    },
    onSuccess: (_, variables) => {
      toast.push(
        variables.nextStatus === "ACTIVE" ? "Artikel diaktifkan untuk AI." : "Artikel dinonaktifkan dari AI.",
        "success",
      );
      queryClient.invalidateQueries({ queryKey: ["knowledge"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-overview"] });
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal mengubah status artikel.", "error"),
    onSettled: () => {
      setPendingToggleId(null);
    },
  });
  const aiTester = useMutation({
    mutationFn: (message: string) => apiClient.post<AiKnowledgeTestResult>("/api/v1/ai/test-answer", { message }),
    onError: (err) => {
      toast.push(err instanceof ApiError ? err.message : "Gagal menjalankan test AI.", "error");
    },
  });

  const docs = query.data?.items ?? [];
  const overviewItems = overview.data?.items ?? [];
  const stats = {
    total: overviewItems.length,
    active: overviewItems.filter((item) => item.status === "ACTIVE").length,
    nonActive: overviewItems.filter((item) => item.status === "NON_ACTIVE").length,
  };
  const activeFilterCount = [status, audience, categoryId, search.trim()].filter(Boolean).length;
  const selectedPreviewMessage =
    previewMessages.find((message) => message.id === selectedMessageId && message.result) ??
    [...previewMessages].reverse().find((message) => message.result) ??
    null;
  const testResult = selectedPreviewMessage?.result ?? null;
  const previewAiName = testResult?.site.aiName ?? "Solid Prime AI";

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      KNOWLEDGE_PREVIEW_STORAGE_KEY,
      JSON.stringify({
        draft: testMessage,
        messages: previewMessages.filter((message) => !message.pending),
        selectedMessageId,
      } satisfies StoredKnowledgePreviewState),
    );
  }, [previewMessages, selectedMessageId, testMessage]);

  useEffect(() => {
    previewEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [previewMessages.length, aiTester.isPending]);

  async function handleAiPreviewSend() {
    const prompt = testMessage.trim();
    if (prompt.length < 2 || aiTester.isPending) return;

    const visitorMessage: KnowledgePreviewMessage = {
      id: crypto.randomUUID(),
      role: "VISITOR",
      content: prompt,
      createdAt: new Date().toISOString(),
    };
    const assistantMessageId = crypto.randomUUID();
    const pendingAssistantMessage: KnowledgePreviewMessage = {
      id: assistantMessageId,
      role: "AI",
      content: "",
      createdAt: new Date().toISOString(),
      pending: true,
    };

    setPreviewMessages((current) => [...current, visitorMessage, pendingAssistantMessage]);
    setSelectedMessageId(assistantMessageId);
    setTestMessage("");

    try {
      const result = await aiTester.mutateAsync(prompt);
      const answerContent =
        result.answer?.formattedAnswer?.trim() ||
        (result.forcedHandoffReason
          ? `Pertanyaan ini akan langsung dialihkan ke agent: ${result.forcedHandoffReason}.`
          : "AI tidak mengembalikan jawaban untuk pertanyaan ini.");

      setPreviewMessages((current) =>
        current.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                role: result.answer ? "AI" : "SYSTEM",
                pending: false,
                content: answerContent,
                result,
              }
            : message,
        ),
      );
      setSelectedMessageId(assistantMessageId);
      toast.push("Preview AI dan knowledge berhasil dibuat.", "success");
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : "Gagal menjalankan test AI.";
      setPreviewMessages((current) =>
        current.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                role: "SYSTEM",
                pending: false,
                error: true,
                content: errorMessage,
              }
            : message,
        ),
      );
      setSelectedMessageId((current) => (current === assistantMessageId ? null : current));
      setTestMessage(prompt);
    }
  }

  function handleResetPreview() {
    setTestMessage("");
    setPreviewMessages([]);
    setSelectedMessageId(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(KNOWLEDGE_PREVIEW_STORAGE_KEY);
    }
  }

  return (
    <>
      <Topbar title="Knowledge Base" />
      <main className="scrollbar-thin flex-1 overflow-y-auto p-6 xl:p-8">
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,text/markdown"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && !file.name.toLowerCase().endsWith(".md")) {
              toast.push("Knowledge hanya menerima file Markdown (.md).", "error");
            } else if (file) {
              upload.mutate(file);
            }
            e.target.value = "";
          }}
        />

        <Card className="mb-6 overflow-hidden border-gold-500/15 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.16),transparent_34%),linear-gradient(180deg,rgba(33,33,37,0.96),rgba(17,17,20,0.98))] p-0">
          <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.3fr)_auto] lg:items-end">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge tone="gold">Markdown Only</Badge>
                <Badge tone="blue">Simple Status</Badge>
                <Badge tone="green">AI Retrieval Ready</Badge>
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">Knowledge Base yang lebih siap dipakai harian</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-300">
                Kelola artikel markdown dengan status sederhana: aktif atau non-aktif. Hanya Super Admin yang dapat mengubah isi Knowledge Base.
              </p>
            </div>
            {isSuperAdmin ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={upload.isPending}>
                  Upload Markdown
                </Button>
                <Link href="/knowledge/new">
                  <Button>+ Artikel Baru</Button>
                </Link>
              </div>
            ) : (
              <div className="rounded-xl border border-ink-600 bg-ink-900/50 px-4 py-3 text-sm text-zinc-400">
                Mode baca saja. Perubahan KB hanya untuk Super Admin.
              </div>
            )}
          </div>
        </Card>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border-ink-500/60 bg-ink-800/75">
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Total Artikel</p>
            <p className="mt-3 text-3xl font-semibold text-zinc-50">{stats.total}</p>
            <p className="mt-2 text-sm text-zinc-400">Seluruh artikel knowledge yang tersedia di site ini.</p>
          </Card>
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-300/80">Active</p>
            <p className="mt-3 text-3xl font-semibold text-zinc-50">{stats.active}</p>
            <p className="mt-2 text-sm text-zinc-400">Artikel aktif yang dipakai untuk knowledge retrieval AI.</p>
          </Card>
          <Card className="border-ink-500/60 bg-ink-800/75">
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">Non Active</p>
            <p className="mt-3 text-3xl font-semibold text-zinc-50">{stats.nonActive}</p>
            <p className="mt-2 text-sm text-zinc-400">Artikel tersimpan tetapi belum dipakai AI customer.</p>
          </Card>
          <Card className="border-gold-500/20 bg-gold-500/5">
            <p className="text-xs uppercase tracking-[0.22em] text-gold-500/80">Access</p>
            <p className="mt-3 text-xl font-semibold text-zinc-50">{isSuperAdmin ? "Super Admin" : "Read Only"}</p>
            <p className="mt-2 text-sm text-zinc-400">Perubahan Knowledge Base dibatasi khusus untuk role Super Admin.</p>
          </Card>
        </section>

        <Card className="mb-6 overflow-hidden border-blue-500/20 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_28%),linear-gradient(180deg,rgba(33,33,37,0.96),rgba(17,17,20,0.98))]">
          <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge tone="blue">AI Tester</Badge>
                <Badge tone="green">Knowledge ACTIVE</Badge>
                <Badge tone="gold">Chat Preview</Badge>
              </div>
              <h3 className="text-xl font-semibold tracking-tight text-zinc-50">Testing AI dan knowledge yang sedang aktif</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-300">
                Buka modal preview untuk menguji AI seperti customer tanpa memakan area utama halaman Knowledge Base.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl border border-ink-600 bg-ink-900/60 px-4 py-3 text-sm text-zinc-300">
                {previewMessages.length > 0 ? `${previewMessages.length} item transcript tersimpan` : "Belum ada transcript test"}
              </div>
              <Button onClick={() => setIsPreviewOpen(true)}>Buka AI Tester</Button>
            </div>
          </div>
        </Card>

        <Card className="hidden">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <Badge tone="blue">AI Tester</Badge>
            <Badge tone="green">Knowledge ACTIVE</Badge>
            <Badge tone="gold">Chat Preview</Badge>
          </div>
          <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.86fr)_minmax(0,1.34fr)]">
            <section className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-zinc-50">Testing AI dan knowledge yang sedang aktif</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  Kirim pertanyaan seperti customer. Preview di kanan berbentuk transcript chat, dan klik balasan AI untuk melihat detail intent, confidence, retrieval, serta evidence di inspector ini.
                </p>
              </div>

              <Card className="border-ink-500/60 bg-ink-900/70 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Intent</p>
                    <p className="mt-2 text-sm font-semibold text-zinc-100">{testResult?.classification.intent ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Confidence</p>
                    <p className="mt-2 text-sm font-semibold text-zinc-100">
                      {testResult ? `${Math.round(testResult.classification.confidence * 100)}%` : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Sentiment</p>
                    <p className="mt-2 text-sm font-semibold text-zinc-100">{testResult?.classification.sentiment ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Evidence</p>
                    <p className="mt-2 text-sm font-semibold text-zinc-100">{testResult ? `${testResult.evidence.length} sumber` : "-"}</p>
                  </div>
                </div>
              </Card>

              <Card className="border-ink-500/60 bg-ink-900/70 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="gold">{testResult?.site.aiName ?? "AI Preview"}</Badge>
                  <Badge tone="blue">{testResult?.site.language?.toUpperCase() ?? "ID"}</Badge>
                  {testResult?.forcedHandoffReason ? <Badge tone="red">Forced Handoff: {testResult.forcedHandoffReason}</Badge> : null}
                  {testResult?.classification.containsSensitiveData ? <Badge tone="amber">Sensitive Data</Badge> : null}
                  {testResult?.classification.promptInjectionDetected ? <Badge tone="red">Prompt Injection</Badge> : null}
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.22em] text-zinc-500">Query Retrieval</p>
                <p className="mt-2 rounded-xl border border-ink-600 bg-ink-800/80 px-3 py-3 text-sm text-zinc-200">
                  {testResult?.retrievalQuery || "Pilih salah satu balasan AI dari transcript untuk melihat query retrieval-nya."}
                </p>
              </Card>

              <Card className="border-ink-500/60 bg-ink-900/70 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-100">Evidence yang Dipakai</h4>
                    <p className="mt-1 text-xs text-zinc-500">Chunk knowledge atau market evidence yang masuk ke prompt jawaban terpilih.</p>
                  </div>
                  <span className="text-xs text-zinc-500">{testResult?.evidence.length ?? 0} item</span>
                </div>
                <div className="space-y-3">
                  {testResult?.evidence.length ? (
                    testResult.evidence.map((item) => (
                      <div key={item.chunkId} className="rounded-xl border border-ink-600 bg-ink-800/80 px-4 py-4">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge tone={item.sourceType === "MARKET" ? "blue" : "green"}>{item.sourceType}</Badge>
                          <Badge tone="neutral">{item.audience}</Badge>
                          <Badge tone="gold">v{item.version}</Badge>
                        </div>
                        <p className="text-sm font-semibold text-zinc-100">{item.title}</p>
                        <p className="mt-2 text-sm leading-6 text-zinc-400">{truncateEvidence(item.content)}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-ink-600 bg-ink-800/40 px-4 py-4 text-sm text-zinc-500">
                      Belum ada evidence yang dipilih. Kirim pertanyaan lalu klik balasan AI untuk memeriksa sumber knowledge yang dipakai.
                    </div>
                  )}
                </div>
              </Card>
            </section>

            <section className="flex items-start justify-center">
              <div className="flex w-full max-w-[390px] min-h-[720px] flex-col overflow-hidden rounded-[18px] border border-zinc-700 bg-[#1f1f23] shadow-[0_28px_80px_rgba(0,0,0,0.34)]">
                <div className="flex items-center justify-between bg-[linear-gradient(180deg,#ffcd4d_0%,#f4ba33_100%)] px-4 py-4 text-ink-950">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#fff1c1,#d28c2d_68%,#7d4b11)] text-sm font-semibold text-white shadow-inner">
                      AI
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold leading-none">{previewAiName}</p>
                      <div className="mt-1 flex items-center gap-1.5 text-[12px] text-ink-900/80">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Online
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Reset preview chat"
                    onClick={handleResetPreview}
                    className="rounded-full p-2 text-ink-900/70 transition-colors hover:bg-white/15 hover:text-ink-950"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto bg-[#1f1f23] px-4 py-5">
                  <div className="flex justify-start">
                    <div className="max-w-[82%]">
                      <div className="mb-1 flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#fff1c1,#d28c2d_68%,#7d4b11)] text-[10px] font-semibold text-white">
                          AI
                        </div>
                        <span className="text-xs font-medium text-gold-300">{previewAiName}</span>
                      </div>
                      <div className="rounded-2xl rounded-tl-sm bg-[#2d2d33] px-4 py-3 text-sm leading-6 text-zinc-100">
                        {getPreviewGreeting(previewAiName)}
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-500">{formatPreviewTime(new Date().toISOString())}</div>
                    </div>
                  </div>

                  {previewMessages.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-5 text-center text-sm leading-6 text-zinc-500">
                      Belum ada transcript. Kirim pertanyaan pertama untuk menguji knowledge aktif.
                    </div>
                  ) : null}

                  {previewMessages.map((message) => {
                    if (message.role === "VISITOR") {
                      return (
                        <div key={message.id} className="flex justify-end">
                          <div className="max-w-[82%]">
                            <div className="rounded-2xl rounded-br-sm bg-gold-500 px-4 py-3 text-sm leading-6 text-ink-950">
                              <div className="whitespace-pre-wrap">{message.content}</div>
                            </div>
                            <div className="mt-1 text-right text-[11px] text-zinc-500">{formatPreviewTime(message.createdAt)}</div>
                          </div>
                        </div>
                      );
                    }

                    if (message.pending) {
                      return (
                        <div key={message.id} className="flex justify-start">
                          <div className="max-w-[82%]">
                            <div className="mb-1 flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#fff1c1,#d28c2d_68%,#7d4b11)] text-[10px] font-semibold text-white">
                                AI
                              </div>
                              <span className="text-xs font-medium text-gold-300">{previewAiName}</span>
                            </div>
                            <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-[#2d2d33] px-4 py-3">
                              <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-300 [animation-delay:-0.3s]" />
                              <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-300 [animation-delay:-0.15s]" />
                              <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-300" />
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const isAssistant = message.role === "AI";
                    const isSelected = selectedMessageId === message.id;
                    const assistantLabel = message.result?.site.aiName ?? previewAiName;

                    return (
                      <div key={message.id} className="flex justify-start">
                        <div className="max-w-[86%]">
                          <div className="mb-1 flex items-center gap-2">
                            <div
                              className={cn(
                                "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white",
                                isAssistant ? "bg-[radial-gradient(circle_at_30%_30%,#fff1c1,#d28c2d_68%,#7d4b11)]" : "bg-zinc-700",
                              )}
                            >
                              {isAssistant ? "AI" : "SYS"}
                            </div>
                            <span className={cn("text-xs font-medium", isAssistant ? "text-gold-300" : "text-zinc-400")}>
                              {isAssistant ? assistantLabel : "System"}
                            </span>
                          </div>
                          <div
                            role={message.result ? "button" : undefined}
                            tabIndex={message.result ? 0 : undefined}
                            onClick={() => {
                              if (message.result) setSelectedMessageId(message.id);
                            }}
                            onKeyDown={(event) => {
                              if (!message.result) return;
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setSelectedMessageId(message.id);
                              }
                            }}
                            className={cn(
                              "w-full rounded-2xl rounded-tl-sm border px-4 py-3 text-left text-sm leading-6 transition-colors",
                              isAssistant
                                ? "ai-tester-markdown border-zinc-700 bg-[#2d2d33] text-zinc-100 hover:border-gold-500/40"
                                : message.error
                                  ? "border-red-500/25 bg-red-500/10 text-red-100"
                                  : "border-zinc-700 bg-zinc-800/80 text-zinc-300",
                              message.result ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold-500/40" : "cursor-default",
                              isSelected ? "border-gold-500/60 shadow-[0_0_0_1px_rgba(212,175,55,0.15)]" : "",
                            )}
                          >
                            {isAssistant ? (
                              <div data-color-mode="dark">
                                <MarkdownPreview source={message.content} />
                              </div>
                            ) : (
                              <div className="whitespace-pre-wrap">{message.content}</div>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                            <span>{formatPreviewTime(message.createdAt)}</span>
                            {message.result?.answer ? <span>{Math.round(message.result.answer.confidence * 100)}%</span> : null}
                            {message.result?.answer?.lowConfidence ? <Badge tone="amber">Low Confidence</Badge> : null}
                            {message.result?.answer?.wouldAutoHandoff ? <Badge tone="gold">Auto Handoff</Badge> : null}
                            {message.result?.answer?.handoffReason ? <Badge tone="red">{message.result.answer.handoffReason}</Badge> : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={previewEndRef} />
                </div>

                <div className="border-t border-zinc-700 bg-[#1f1f23] px-3 py-3">
                  <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
                    <button
                      type="button"
                      className="underline decoration-dotted underline-offset-2 hover:text-white"
                      onClick={() => setTestMessage(PREVIEW_SAMPLE_MESSAGE)}
                    >
                      Isi Contoh
                    </button>
                    <span className="text-zinc-600">•</span>
                    <span className="text-zinc-500">History tersimpan di browser dashboard</span>
                  </div>
                  <div className="flex items-end gap-2">
                    <Textarea
                      value={testMessage}
                      onChange={(event) => setTestMessage(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          handleAiPreviewSend().catch(() => undefined);
                        }
                      }}
                      placeholder="Ketik pertanyaan untuk test AI dan knowledge..."
                      rows={1}
                      className="min-h-[54px] resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm leading-5 text-white placeholder:text-zinc-500 focus:border-gold-500/70"
                    />
                    <button
                      type="button"
                      onClick={() => handleAiPreviewSend().catch(() => undefined)}
                      disabled={aiTester.isPending || testMessage.trim().length < 2}
                      aria-label="Kirim test"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-500 text-ink-950 transition-opacity disabled:opacity-40"
                    >
                      <Send className="h-4 w-4" strokeWidth={2.5} />
                    </button>
                  </div>
                  <p className="mt-2 text-center text-[10px] text-zinc-600">Preview ini hanya untuk testing AI dan knowledge aktif.</p>
                </div>
              </div>
            </section>
          </div>
        </Card>

        <Card className="mb-6 border-ink-500/60 bg-ink-800/75">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Filter dan Pencarian</h3>
              <p className="mt-1 text-sm text-zinc-400">Cari artikel berdasarkan konten, lalu saring dengan status, audience, dan kategori.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span>{docs.length} artikel tampil</span>
              {activeFilterCount > 0 && <span>{activeFilterCount} filter aktif</span>}
            </div>
          </div>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,180px))]">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">Cari Artikel</label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari judul, ringkasan, atau isi markdown..." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">Status</label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Semua status</option>
                {["ACTIVE", "NON_ACTIVE"].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">Audience</label>
              <Select value={audience} onChange={(e) => setAudience(e.target.value)}>
                <option value="">Semua audience</option>
                <option value="PUBLIC">PUBLIC</option>
                <option value="AGENT_ONLY">AGENT_ONLY</option>
                <option value="INTERNAL">INTERNAL</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">Kategori</label>
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Semua kategori</option>
                {categories.data?.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </Card>

        <Card className="mb-4 text-sm text-zinc-400">
          Knowledge disimpan sebagai Markdown. Upload file dibatasi ke <code className="rounded bg-ink-900 px-1.5 py-0.5 text-zinc-200">.md</code>, dan hanya artikel berstatus <code className="rounded bg-ink-900 px-1.5 py-0.5 text-zinc-200">ACTIVE</code> yang dipakai untuk retrieval AI.
        </Card>

        <Card className="overflow-hidden !p-0">
          <div className="flex items-center justify-between border-b border-ink-700 px-4 py-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Daftar Artikel</h3>
              <p className="mt-1 text-sm text-zinc-500">Ringkasan, kategori, audience, dan status review dalam satu tabel kerja.</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatus("");
                setAudience("");
                setCategoryId("");
                setSearch("");
              }}
            >
              Reset Filter
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-ink-700/50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Artikel</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3">Audience</th>
                  <th className="px-4 py-3">Versi</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Diperbarui</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.id} className="border-t border-ink-700 hover:bg-ink-700/30">
                    <td className="px-4 py-4">
                      <Link href={`/knowledge/${doc.id}`} className="text-sm font-medium text-zinc-100 hover:text-gold-500">
                        {doc.title}
                      </Link>
                      <p className="mt-1 max-w-xl text-sm leading-6 text-zinc-500">
                        {doc.summary?.trim() || "Belum ada ringkasan. Buka artikel untuk melengkapi konteks konten."}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-zinc-400">{doc.category?.name ?? "Tanpa kategori"}</td>
                    <td className="px-4 py-4 text-zinc-400">{doc.audience}</td>
                    <td className="px-4 py-4 text-zinc-400">v{doc.version}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <Badge tone={STATUS_TONE[doc.status] ?? "neutral"}>{doc.status}</Badge>
                        {isSuperAdmin && (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={doc.status === "ACTIVE"}
                            aria-label={doc.status === "ACTIVE" ? `Nonaktifkan ${doc.title}` : `Aktifkan ${doc.title}`}
                            onClick={() =>
                              toggleStatus.mutate({
                                id: doc.id,
                                nextStatus: doc.status === "ACTIVE" ? "NON_ACTIVE" : "ACTIVE",
                              })
                            }
                            disabled={pendingToggleId === doc.id || removeArticle.isPending}
                            className={cn(
                              "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors",
                              doc.status === "ACTIVE"
                                ? "border-emerald-400/40 bg-emerald-500"
                                : "border-ink-500 bg-zinc-600",
                              pendingToggleId === doc.id || removeArticle.isPending ? "cursor-wait opacity-60" : "cursor-pointer",
                            )}
                          >
                            <span
                              className={cn(
                                "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                                doc.status === "ACTIVE" ? "translate-x-6" : "translate-x-1",
                              )}
                            />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-zinc-500">{new Date(doc.updatedAt).toLocaleDateString("id-ID")}</td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <Link href={`/knowledge/${doc.id}`}>
                          <Button variant="ghost" size="sm">
                            {isSuperAdmin ? "Lihat/Edit" : "Lihat"}
                          </Button>
                        </Link>
                        {isSuperAdmin && (
                          <Button variant="danger" size="sm" onClick={() => setDeletingDoc(doc)} disabled={removeArticle.isPending}>
                            Hapus
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {docs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <div className="mx-auto max-w-md">
                        <p className="text-base font-medium text-zinc-200">Belum ada artikel yang cocok dengan filter saat ini.</p>
                        <p className="mt-2 text-sm leading-6 text-zinc-500">Coba reset filter atau tambahkan artikel markdown baru agar knowledge siap dipakai tim dan AI.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
      <Modal
        open={isPreviewOpen}
        title="AI Tester"
        onClose={() => setIsPreviewOpen(false)}
        panelClassName="max-h-[90vh] max-w-6xl overflow-hidden p-0"
      >
        <div className="grid h-[min(78vh,760px)] min-h-0 gap-0 lg:grid-cols-[minmax(340px,0.9fr)_minmax(420px,1.1fr)]">
          <section className="scrollbar-thin min-h-0 overflow-y-auto border-b border-ink-700 p-6 lg:border-b-0 lg:border-r">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <Badge tone="blue">AI Tester</Badge>
              <Badge tone="green">Knowledge ACTIVE</Badge>
              <Badge tone="gold">Chat Preview</Badge>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-zinc-50">Testing AI dan knowledge yang sedang aktif</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  Kirim pertanyaan seperti customer. Klik balasan AI untuk melihat detail intent, confidence, retrieval, serta evidence di inspector ini.
                </p>
              </div>

              <Card className="border-ink-500/60 bg-ink-900/70 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Intent</p>
                    <p className="mt-2 text-sm font-semibold text-zinc-100">{testResult?.classification.intent ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Confidence</p>
                    <p className="mt-2 text-sm font-semibold text-zinc-100">
                      {testResult ? `${Math.round(testResult.classification.confidence * 100)}%` : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Sentiment</p>
                    <p className="mt-2 text-sm font-semibold text-zinc-100">{testResult?.classification.sentiment ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Evidence</p>
                    <p className="mt-2 text-sm font-semibold text-zinc-100">{testResult ? `${testResult.evidence.length} sumber` : "-"}</p>
                  </div>
                </div>
              </Card>

              <Card className="border-ink-500/60 bg-ink-900/70 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="gold">{testResult?.site.aiName ?? "AI Preview"}</Badge>
                  <Badge tone="blue">{testResult?.site.language?.toUpperCase() ?? "ID"}</Badge>
                  {testResult?.forcedHandoffReason ? <Badge tone="red">Forced Handoff: {testResult.forcedHandoffReason}</Badge> : null}
                  {testResult?.classification.containsSensitiveData ? <Badge tone="amber">Sensitive Data</Badge> : null}
                  {testResult?.classification.promptInjectionDetected ? <Badge tone="red">Prompt Injection</Badge> : null}
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.22em] text-zinc-500">Query Retrieval</p>
                <p className="mt-2 rounded-xl border border-ink-600 bg-ink-800/80 px-3 py-3 text-sm text-zinc-200">
                  {testResult?.retrievalQuery || "Pilih salah satu balasan AI dari transcript untuk melihat query retrieval-nya."}
                </p>
              </Card>

              <Card className="border-ink-500/60 bg-ink-900/70 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-100">Evidence yang Dipakai</h4>
                    <p className="mt-1 text-xs text-zinc-500">Chunk knowledge atau market evidence yang masuk ke prompt jawaban terpilih.</p>
                  </div>
                  <span className="text-xs text-zinc-500">{testResult?.evidence.length ?? 0} item</span>
                </div>
                <div className="space-y-3">
                  {testResult?.evidence.length ? (
                    testResult.evidence.map((item) => (
                      <div key={item.chunkId} className="rounded-xl border border-ink-600 bg-ink-800/80 px-4 py-4">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge tone={item.sourceType === "MARKET" ? "blue" : "green"}>{item.sourceType}</Badge>
                          <Badge tone="neutral">{item.audience}</Badge>
                          <Badge tone="gold">v{item.version}</Badge>
                        </div>
                        <p className="text-sm font-semibold text-zinc-100">{item.title}</p>
                        <p className="mt-2 text-sm leading-6 text-zinc-400">{truncateEvidence(item.content)}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-ink-600 bg-ink-800/40 px-4 py-4 text-sm text-zinc-500">
                      Belum ada evidence yang dipilih. Kirim pertanyaan lalu klik balasan AI untuk memeriksa sumber knowledge yang dipakai.
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </section>

          <section className="flex min-h-0 flex-col bg-[#1f1f23]">
            <div className="flex items-center justify-between bg-[linear-gradient(180deg,#ffcd4d_0%,#f4ba33_100%)] px-4 py-4 text-ink-950">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#fff1c1,#d28c2d_68%,#7d4b11)] text-sm font-semibold text-white shadow-inner">
                  AI
                </div>
                <div>
                  <p className="text-[15px] font-semibold leading-none">{previewAiName}</p>
                  <div className="mt-1 flex items-center gap-1.5 text-[12px] text-ink-900/80">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Online
                  </div>
                </div>
              </div>
              <button
                type="button"
                aria-label="Reset preview chat"
                onClick={handleResetPreview}
                className="rounded-full p-2 text-ink-900/70 transition-colors hover:bg-white/15 hover:text-ink-950"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            <div className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5">
              <div className="flex justify-start">
                <div className="max-w-[82%]">
                  <div className="mb-1 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#fff1c1,#d28c2d_68%,#7d4b11)] text-[10px] font-semibold text-white">
                      AI
                    </div>
                    <span className="text-xs font-medium text-gold-300">{previewAiName}</span>
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-[#2d2d33] px-4 py-3 text-sm leading-6 text-zinc-100">
                    {getPreviewGreeting(previewAiName)}
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-500">{formatPreviewTime(new Date().toISOString())}</div>
                </div>
              </div>

              {previewMessages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-5 text-center text-sm leading-6 text-zinc-500">
                  Belum ada transcript. Kirim pertanyaan pertama untuk menguji knowledge aktif.
                </div>
              ) : null}

              {previewMessages.map((message) => {
                if (message.role === "VISITOR") {
                  return (
                    <div key={message.id} className="flex justify-end">
                      <div className="max-w-[82%]">
                        <div className="rounded-2xl rounded-br-sm bg-gold-500 px-4 py-3 text-sm leading-6 text-ink-950">
                          <div className="whitespace-pre-wrap">{message.content}</div>
                        </div>
                        <div className="mt-1 text-right text-[11px] text-zinc-500">{formatPreviewTime(message.createdAt)}</div>
                      </div>
                    </div>
                  );
                }

                if (message.pending) {
                  return (
                    <div key={message.id} className="flex justify-start">
                      <div className="max-w-[82%]">
                        <div className="mb-1 flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#fff1c1,#d28c2d_68%,#7d4b11)] text-[10px] font-semibold text-white">
                            AI
                          </div>
                          <span className="text-xs font-medium text-gold-300">{previewAiName}</span>
                        </div>
                        <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-[#2d2d33] px-4 py-3">
                          <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-300 [animation-delay:-0.3s]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-300 [animation-delay:-0.15s]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-300" />
                        </div>
                      </div>
                    </div>
                  );
                }

                const isAssistant = message.role === "AI";
                const isSelected = selectedMessageId === message.id;
                const assistantLabel = message.result?.site.aiName ?? previewAiName;

                return (
                  <div key={message.id} className="flex justify-start">
                    <div className="max-w-[86%]">
                      <div className="mb-1 flex items-center gap-2">
                        <div
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white",
                            isAssistant ? "bg-[radial-gradient(circle_at_30%_30%,#fff1c1,#d28c2d_68%,#7d4b11)]" : "bg-zinc-700",
                          )}
                        >
                          {isAssistant ? "AI" : "SYS"}
                        </div>
                        <span className={cn("text-xs font-medium", isAssistant ? "text-gold-300" : "text-zinc-400")}>
                          {isAssistant ? assistantLabel : "System"}
                        </span>
                      </div>
                      <div
                        role={message.result ? "button" : undefined}
                        tabIndex={message.result ? 0 : undefined}
                        onClick={() => {
                          if (message.result) setSelectedMessageId(message.id);
                        }}
                        onKeyDown={(event) => {
                          if (!message.result) return;
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedMessageId(message.id);
                          }
                        }}
                        className={cn(
                          "w-full rounded-2xl rounded-tl-sm border px-4 py-3 text-left text-sm leading-6 transition-colors",
                          isAssistant
                            ? "ai-tester-markdown border-zinc-700 bg-[#2d2d33] text-zinc-100 hover:border-gold-500/40"
                            : message.error
                              ? "border-red-500/25 bg-red-500/10 text-red-100"
                              : "border-zinc-700 bg-zinc-800/80 text-zinc-300",
                          message.result ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold-500/40" : "cursor-default",
                          isSelected ? "border-gold-500/60 shadow-[0_0_0_1px_rgba(212,175,55,0.15)]" : "",
                        )}
                      >
                        {isAssistant ? (
                          <div data-color-mode="dark">
                            <MarkdownPreview source={message.content} />
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap">{message.content}</div>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                        <span>{formatPreviewTime(message.createdAt)}</span>
                        {message.result?.answer ? <span>{Math.round(message.result.answer.confidence * 100)}%</span> : null}
                        {message.result?.answer?.lowConfidence ? <Badge tone="amber">Low Confidence</Badge> : null}
                        {message.result?.answer?.wouldAutoHandoff ? <Badge tone="gold">Auto Handoff</Badge> : null}
                        {message.result?.answer?.handoffReason ? <Badge tone="red">{message.result.answer.handoffReason}</Badge> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={previewEndRef} />
            </div>

            <div className="border-t border-zinc-700 px-3 py-3">
              <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
                <button
                  type="button"
                  className="underline decoration-dotted underline-offset-2 hover:text-white"
                  onClick={() => setTestMessage(PREVIEW_SAMPLE_MESSAGE)}
                >
                  Isi Contoh
                </button>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-500">History tersimpan di browser dashboard</span>
              </div>
              <div className="flex items-end gap-2">
                <Textarea
                  value={testMessage}
                  onChange={(event) => setTestMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleAiPreviewSend().catch(() => undefined);
                    }
                  }}
                  placeholder="Ketik pertanyaan untuk test AI dan knowledge..."
                  rows={1}
                  className="min-h-[54px] resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm leading-5 text-white placeholder:text-zinc-500 focus:border-gold-500/70"
                />
                <button
                  type="button"
                  onClick={() => handleAiPreviewSend().catch(() => undefined)}
                  disabled={aiTester.isPending || testMessage.trim().length < 2}
                  aria-label="Kirim test"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-500 text-ink-950 transition-opacity disabled:opacity-40"
                >
                  <Send className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] text-zinc-600">Preview ini hanya untuk testing AI dan knowledge aktif.</p>
            </div>
          </section>
        </div>
      </Modal>
      <ConfirmModal
        open={Boolean(deletingDoc)}
        title="Hapus artikel knowledge?"
        description={deletingDoc ? `Artikel "${deletingDoc.title}" akan dihapus permanen bersama source markdown dan chunk index-nya.` : ""}
        confirmLabel={removeArticle.isPending ? "Menghapus..." : "Hapus Permanen"}
        danger
        onConfirm={() => {
          if (deletingDoc) removeArticle.mutate(deletingDoc.id);
        }}
        onClose={() => {
          if (!removeArticle.isPending) setDeletingDoc(null);
        }}
      />
    </>
  );
}
