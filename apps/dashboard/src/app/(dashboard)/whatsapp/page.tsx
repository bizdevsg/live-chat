"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCheck,
  ChevronDown,
  Image as ImageIcon,
  Info,
  LoaderCircle,
  MessageCircle,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  Settings,
  Smile,
  WifiOff,
  X,
} from "lucide-react";
import Image from "next/image";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { apiClient, ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { Permission } from "@/lib/permissions";

type WahaEngine = "NOWEB" | "WEBJS" | "GOWS" | "WPP";

interface WhatsAppConnection {
  id: string;
  sessionName: string;
  displayName?: string | null;
  phoneNumber: string | null;
  status: string;
  engine: WahaEngine;
  lastError: string | null;
  connectedAt: string | null;
  lastSeenAt: string | null;
}

interface WhatsAppMessage {
  id: string;
  timestamp: number;
  from: string | null;
  to: string | null;
  fromMe: boolean;
  body: string;
  hasMedia: boolean;
  media: { url?: string; mimetype?: string; filename?: string | null; error?: string | null } | null;
  ack: number | null;
  ackName: string | null;
}

interface WhatsAppChat {
  id: string;
  name: string;
  phoneNumber: string;
  picture: string | null;
  unreadCount: number;
  lastMessage: WhatsAppMessage | null;
}

interface WhatsAppContact {
  id: string;
  chatId: string;
  name: string;
  pushName: string | null;
  phoneNumber: string;
  picture: string | null;
}

interface QrResponse {
  mimetype: string;
  data: string;
}

const CONNECTED_STATUSES = new Set(["CONNECTED", "WORKING"]);

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "WA";
}

function formatPhone(phone?: string | null) {
  if (!phone) return "Nomor belum tersedia";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return `+${digits}`;
  return `+${digits.slice(0, 2)} ${digits.slice(2, 5)}-${digits.slice(5, 9)}-${digits.slice(9)}`.replace(/-$/, "");
}

function formatTime(timestamp?: number) {
  if (!timestamp) return "";
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp * 1000));
}

function formatListTime(timestamp?: number) {
  if (!timestamp) return "";
  const date = new Date(timestamp * 1000);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return formatTime(timestamp);
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(date);
}

function Avatar({ name, picture, size = "md" }: { name: string; picture?: string | null; size?: "sm" | "md" | "lg" }) {
  const sizes = size === "lg" ? "h-20 w-20 text-xl" : size === "sm" ? "h-10 w-10 text-xs" : "h-11 w-11 text-sm";
  return (
    <div className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-emerald-600 font-semibold text-white", sizes)}>
      {picture ? <img src={picture} alt="" className="absolute inset-0 h-full w-full object-cover" /> : initials(name)}
    </div>
  );
}

export default function WhatsAppPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const canManageConnection = useAuthStore((state) => state.hasPermission(Permission.INTEGRATION_MANAGE));
  const [selectedChatId, setSelectedChatId] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [message, setMessage] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [engine, setEngine] = useState<WahaEngine>("NOWEB");
  const messageEndRef = useRef<HTMLDivElement>(null);

  const connectionQuery = useQuery({
    queryKey: ["whatsapp", "connection"],
    queryFn: () => apiClient.get<WhatsAppConnection | null>("/api/v1/whatsapp/connection"),
    refetchInterval: 5_000,
  });
  const connection = connectionQuery.data;
  const connected = Boolean(connection?.status && CONNECTED_STATUSES.has(connection.status));

  useEffect(() => {
    if (connection?.engine) setEngine(connection.engine);
    if (connection && !connected) setShowSettings(true);
  }, [connected, connection]);

  const chatsQuery = useQuery({
    queryKey: ["whatsapp", "chats"],
    queryFn: () => apiClient.get<WhatsAppChat[]>("/api/v1/whatsapp/chats?limit=100"),
    enabled: connected,
    refetchInterval: 4_000,
  });
  const chats = chatsQuery.data ?? [];

  useEffect(() => {
    if (!selectedChatId && chats[0]?.id) setSelectedChatId(chats[0].id);
    if (selectedChatId && chats.length && !chats.some((chat) => chat.id === selectedChatId)) setSelectedChatId(chats[0]?.id ?? "");
  }, [chats, selectedChatId]);

  const selectedChat = chats.find((chat) => chat.id === selectedChatId) ?? null;
  const encodedChatId = selectedChatId ? encodeURIComponent(selectedChatId) : "";
  const messagesQuery = useQuery({
    queryKey: ["whatsapp", "messages", selectedChatId],
    queryFn: () => apiClient.get<WhatsAppMessage[]>(`/api/v1/whatsapp/chats/${encodedChatId}/messages?limit=100`),
    enabled: connected && Boolean(selectedChatId),
    refetchInterval: 3_000,
  });
  const contactQuery = useQuery({
    queryKey: ["whatsapp", "contact", selectedChatId],
    queryFn: () => apiClient.get<WhatsAppContact>(`/api/v1/whatsapp/chats/${encodedChatId}/contact`),
    enabled: connected && Boolean(selectedChatId),
    staleTime: 60_000,
  });

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesQuery.data?.length, selectedChatId]);

  useEffect(() => {
    if (!selectedChatId || !selectedChat?.unreadCount) return;
    void apiClient.post(`/api/v1/whatsapp/chats/${encodeURIComponent(selectedChatId)}/read`, {}).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["whatsapp", "chats"] });
    }).catch(() => undefined);
  }, [queryClient, selectedChat?.unreadCount, selectedChatId]);

  const connectMutation = useMutation({
    mutationFn: () => apiClient.post<WhatsAppConnection>("/api/v1/whatsapp/connection", { engine }),
    onSuccess: async () => {
      toast.push("Session WAHA dimulai. Pindai QR untuk menghubungkan WhatsApp.", "success");
      await queryClient.invalidateQueries({ queryKey: ["whatsapp"] });
    },
    onError: (error) => toast.push(errorMessage(error, "Gagal memulai session WhatsApp."), "error"),
  });
  const disconnectMutation = useMutation({
    mutationFn: () => apiClient.delete("/api/v1/whatsapp/connection"),
    onSuccess: async () => {
      setSelectedChatId("");
      toast.push("WhatsApp berhasil diputuskan.", "success");
      await queryClient.invalidateQueries({ queryKey: ["whatsapp"] });
    },
    onError: (error) => toast.push(errorMessage(error, "Gagal memutuskan WhatsApp."), "error"),
  });
  const sendMutation = useMutation({
    mutationFn: (text: string) => apiClient.post(`/api/v1/whatsapp/chats/${encodedChatId}/messages`, { text }),
    onSuccess: async () => {
      setMessage("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["whatsapp", "messages", selectedChatId] }),
        queryClient.invalidateQueries({ queryKey: ["whatsapp", "chats"] }),
      ]);
    },
    onError: (error) => toast.push(errorMessage(error, "Pesan WhatsApp gagal dikirim."), "error"),
  });

  const qrQuery = useQuery({
    queryKey: ["whatsapp", "qr", connection?.id],
    queryFn: () => apiClient.get<QrResponse>("/api/v1/whatsapp/connection/qr"),
    enabled: canManageConnection && Boolean(connection && !connected),
    retry: false,
    refetchInterval: connected ? false : 5_000,
  });
  const qrSource = useMemo(() => {
    if (!qrQuery.data?.data) return null;
    return qrQuery.data.data.startsWith("data:")
      ? qrQuery.data.data
      : `data:${qrQuery.data.mimetype || "image/png"};base64,${qrQuery.data.data}`;
  }, [qrQuery.data]);

  const filteredChats = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return chats.filter((chat) => {
      if (filter === "unread" && chat.unreadCount <= 0) return false;
      if (!needle) return true;
      return chat.name.toLowerCase().includes(needle) || chat.phoneNumber.includes(needle);
    });
  }, [chats, filter, search]);

  const contact = contactQuery.data;
  const displayName = contact?.name ?? selectedChat?.name ?? "Pilih percakapan";
  const displayPhone = contact?.phoneNumber ?? selectedChat?.phoneNumber;

  const submitMessage = () => {
    const text = message.trim();
    if (!text || !selectedChatId || sendMutation.isPending) return;
    sendMutation.mutate(text);
  };

  return (
    <>
      <Topbar title="WhatsApp" />
      <main className="min-w-0 flex-1 overflow-hidden bg-ink-950 p-3 sm:p-4">
        <section className="flex h-[calc(100dvh-6.5rem)] min-h-[38rem] flex-col overflow-hidden rounded-2xl border border-ink-600 bg-ink-900 shadow-2xl">
          <header className="flex min-h-20 flex-wrap items-center justify-between gap-4 border-b border-ink-600 px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={connection?.displayName || "WhatsApp"} size="md" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-base font-semibold text-zinc-100">{connection?.displayName || "WhatsApp Inbox"}</h1>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", connected ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-700 text-zinc-400")}>
                    {connected ? "Terhubung" : connection?.status ?? "Belum terhubung"}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-zinc-500">{formatPhone(connection?.phoneNumber)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => void queryClient.invalidateQueries({ queryKey: ["whatsapp"] })}>
                <RefreshCw className={cn("h-4 w-4", (connectionQuery.isFetching || chatsQuery.isFetching) && "animate-spin")} />
                <span className="hidden sm:inline">Perbarui</span>
              </Button>
              {canManageConnection ? (
                <Button variant="secondary" size="sm" onClick={() => setShowSettings(true)}>
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Pengaturan koneksi</span>
                </Button>
              ) : null}
            </div>
          </header>

          {!connected ? (
            <div className="grid flex-1 place-items-center px-6 py-12 text-center">
              <div className="max-w-md">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-ink-600 bg-ink-800 text-zinc-400">
                  <WifiOff className="h-7 w-7" />
                </div>
                <h2 className="mt-5 text-xl font-semibold text-zinc-100">WhatsApp belum terhubung</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-500">Hubungkan akun WhatsApp untuk membuka inbox khusus dan membalas pesan langsung dari WAHA.</p>
                {canManageConnection ? <Button className="mt-6 bg-emerald-500 text-emerald-950 hover:bg-emerald-400" onClick={() => setShowSettings(true)}>Hubungkan WhatsApp</Button> : null}
              </div>
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 xl:grid-cols-[20rem_minmax(24rem,1fr)_18rem]">
              <aside className="flex min-h-0 flex-col border-b border-ink-600 xl:border-b-0 xl:border-r">
                <div className="space-y-3 border-b border-ink-600 p-3">
                  <label className="flex h-10 items-center gap-2 rounded-xl border border-ink-600 bg-ink-800 px-3 text-zinc-400 focus-within:border-emerald-700">
                    <Search className="h-4 w-4 shrink-0" />
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari percakapan" className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600" />
                  </label>
                  <div className="flex gap-5 px-1 text-xs font-medium">
                    <button type="button" onClick={() => setFilter("all")} className={cn("border-b-2 pb-2 transition", filter === "all" ? "border-emerald-500 text-emerald-400" : "border-transparent text-zinc-500 hover:text-zinc-300")}>Semua ({chats.length})</button>
                    <button type="button" onClick={() => setFilter("unread")} className={cn("border-b-2 pb-2 transition", filter === "unread" ? "border-emerald-500 text-emerald-400" : "border-transparent text-zinc-500 hover:text-zinc-300")}>Belum dibaca</button>
                  </div>
                </div>
                <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
                  {chatsQuery.isLoading ? <LoadingState label="Memuat percakapan WAHA…" /> : filteredChats.length ? filteredChats.map((chat) => (
                    <button key={chat.id} type="button" onClick={() => setSelectedChatId(chat.id)} className={cn("flex w-full gap-3 border-b border-ink-700/70 px-3 py-3 text-left transition hover:bg-ink-800", selectedChatId === chat.id && "border-l-2 border-l-emerald-500 bg-emerald-500/10")}>
                      <Avatar name={chat.name} picture={chat.picture} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-zinc-100">{chat.name}</span>
                          <span className="shrink-0 text-[11px] text-zinc-500">{formatListTime(chat.lastMessage?.timestamp)}</span>
                        </span>
                        <span className="mt-1 flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-zinc-500">{chat.lastMessage?.body || (chat.lastMessage?.hasMedia ? "Media" : formatPhone(chat.phoneNumber))}</span>
                          {chat.unreadCount > 0 ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-emerald-950">{chat.unreadCount}</span> : null}
                        </span>
                      </span>
                    </button>
                  )) : <EmptyState label={search || filter === "unread" ? "Percakapan tidak ditemukan." : "Belum ada percakapan WhatsApp."} />}
                </div>
              </aside>

              <section className="flex min-h-0 flex-col border-b border-ink-600 xl:border-b-0 xl:border-r">
                {selectedChat ? (
                  <>
                    <div className="flex min-h-16 items-center justify-between gap-3 border-b border-ink-600 px-4 py-2.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={displayName} picture={contact?.picture ?? selectedChat.picture} size="sm" />
                        <div className="min-w-0"><h2 className="truncate text-sm font-semibold text-zinc-100">{displayName}</h2><p className="mt-0.5 truncate text-xs text-zinc-500">{formatPhone(displayPhone)}</p></div>
                      </div>
                      <Info className="h-4 w-4 text-zinc-500" />
                    </div>
                    <div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.05),transparent_34rem)] px-4 py-5 sm:px-6">
                      {messagesQuery.isLoading ? <LoadingState label="Memuat pesan…" /> : (messagesQuery.data ?? []).length ? (messagesQuery.data ?? []).map((item) => (
                        <div key={item.id} className={cn("flex", item.fromMe ? "justify-end" : "justify-start")}>
                          <div className={cn("max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-5 shadow", item.fromMe ? "rounded-br-md bg-emerald-700 text-emerald-50" : "rounded-bl-md border border-ink-600 bg-ink-800 text-zinc-200")}>
                            {item.hasMedia ? <div className="mb-2 flex items-center gap-2 rounded-lg bg-black/15 px-3 py-2 text-xs"><ImageIcon className="h-4 w-4" />{item.media?.filename || "Media WhatsApp"}</div> : null}
                            {item.body ? <p className="whitespace-pre-wrap break-words">{item.body}</p> : null}
                            <div className={cn("mt-1 flex items-center justify-end gap-1 text-[10px]", item.fromMe ? "text-emerald-200/80" : "text-zinc-500")}>
                              {formatTime(item.timestamp)}
                              {item.fromMe ? <CheckCheck className={cn("h-3.5 w-3.5", (item.ack ?? 0) >= 3 && "text-sky-300")} /> : null}
                            </div>
                          </div>
                        </div>
                      )) : <EmptyState label="Belum ada pesan pada percakapan ini." />}
                      <div ref={messageEndRef} />
                    </div>
                    <div className="border-t border-ink-600 bg-ink-900 p-3">
                      <div className="flex items-end gap-2 rounded-xl border border-ink-600 bg-ink-800 p-2 focus-within:border-emerald-700">
                        <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-ink-700 hover:text-zinc-300" aria-label="Lampiran" disabled><Paperclip className="h-4 w-4" /></button>
                        <textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submitMessage(); } }} rows={1} placeholder="Tulis pesan..." className="max-h-28 min-h-9 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600" />
                        <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-ink-700 hover:text-zinc-300" aria-label="Emoji" disabled><Smile className="h-4 w-4" /></button>
                        <button type="button" onClick={submitMessage} disabled={!message.trim() || sendMutation.isPending} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500 text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Kirim pesan">{sendMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
                      </div>
                    </div>
                  </>
                ) : <div className="grid flex-1 place-items-center"><EmptyState label="Pilih percakapan untuk mulai membalas." /></div>}
              </section>

              <aside className="scrollbar-thin min-h-0 overflow-y-auto p-5">
                <h2 className="text-sm font-semibold text-zinc-100">Info kontak</h2>
                {selectedChat ? (
                  <div className="mt-7">
                    <div className="flex flex-col items-center text-center">
                      <Avatar name={displayName} picture={contact?.picture ?? selectedChat.picture} size="lg" />
                      <h3 className="mt-4 font-semibold text-zinc-100">{displayName}</h3>
                      <p className="mt-1 text-sm text-zinc-500">{formatPhone(displayPhone)}</p>
                    </div>
                    <dl className="mt-7 space-y-5 border-t border-ink-600 pt-5">
                      <ContactRow label="Nama dari WhatsApp" value={contact?.pushName || contact?.name || selectedChat.name} />
                      <ContactRow label="Nomor WhatsApp" value={formatPhone(displayPhone)} />
                      <ContactRow label="WhatsApp ID" value={contact?.chatId || selectedChat.id} mono />
                      <ContactRow label="Session" value={connection?.displayName || connection?.sessionName || "-"} />
                      <ContactRow label="Aktivitas terakhir" value={selectedChat.lastMessage?.timestamp ? new Date(selectedChat.lastMessage.timestamp * 1000).toLocaleString("id-ID") : "Belum ada aktivitas"} />
                    </dl>
                  </div>
                ) : <EmptyState label="Detail kontak akan muncul setelah percakapan dipilih." />}
              </aside>
            </div>
          )}
        </section>
      </main>

      {showSettings && canManageConnection ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowSettings(false); }}>
          <aside className="scrollbar-thin h-full w-full max-w-md overflow-y-auto border-l border-ink-600 bg-ink-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-ink-600 px-5 py-4"><h2 className="font-semibold text-zinc-100">Pengaturan WhatsApp</h2><button type="button" onClick={() => setShowSettings(false)} className="rounded-lg p-2 text-zinc-500 hover:bg-ink-800 hover:text-zinc-200"><X className="h-4 w-4" /></button></div>
            <div className="space-y-6 p-5">
              <div><label htmlFor="waha-engine" className="mb-2 block text-xs font-medium text-zinc-400">Engine WAHA</label><Select id="waha-engine" value={engine} onChange={(event) => setEngine(event.target.value as WahaEngine)} disabled={connected || connectMutation.isPending}><option value="NOWEB">NOWEB</option><option value="GOWS">GOWS</option><option value="WEBJS">WEBJS</option><option value="WPP">WPP</option></Select></div>
              {connected ? (
                <div className="rounded-xl border border-emerald-900/80 bg-emerald-950/30 p-4"><div className="flex items-center gap-2 text-sm font-medium text-emerald-400"><CheckCheck className="h-4 w-4" />WhatsApp terhubung</div><p className="mt-2 text-xs leading-5 text-zinc-500">{connection?.displayName || formatPhone(connection?.phoneNumber)}</p></div>
              ) : qrSource ? (
                <div className="text-center"><div className="inline-block rounded-2xl bg-white p-3"><Image src={qrSource} alt="QR koneksi WhatsApp" width={280} height={280} unoptimized className="h-auto w-64" /></div><p className="mt-4 text-sm font-medium text-zinc-200">Pindai kode QR</p><p className="mt-2 text-xs leading-5 text-zinc-500">Buka WhatsApp di ponsel, masuk ke Perangkat tertaut, lalu pindai kode ini.</p></div>
              ) : connection ? <LoadingState label="Menunggu QR dari WAHA…" /> : (
                <div className="rounded-xl border border-ink-600 bg-ink-800 p-4"><div className="flex items-center gap-2 text-sm font-medium text-zinc-200"><MessageCircle className="h-4 w-4 text-emerald-400" />Hubungkan WhatsApp</div><p className="mt-2 text-xs leading-5 text-zinc-500">Chat, nama, nomor, dan riwayat pesan akan dibaca langsung dari WAHA. Tidak ada AI yang membalas pesan.</p></div>
              )}
              {connection?.lastError ? <div className="rounded-xl border border-red-900/70 bg-red-950/30 p-4 text-xs leading-5 text-red-300">{connection.lastError}</div> : null}
              <div className="flex flex-wrap gap-2">
                {!connected ? <Button className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400" onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>{connection ? "Mulai ulang koneksi" : "Hubungkan WhatsApp"}</Button> : null}
                {connection ? <Button variant="danger" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}>Putuskan</Button> : null}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function ContactRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">{label}</dt><dd className={cn("mt-1.5 break-words text-sm text-zinc-300", mono && "font-mono text-xs")}>{value}</dd></div>;
}

function LoadingState({ label }: { label: string }) {
  return <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-zinc-500"><LoaderCircle className="h-4 w-4 animate-spin" />{label}</div>;
}

function EmptyState({ label }: { label: string }) {
  return <div className="px-6 py-14 text-center"><MessageCircle className="mx-auto h-7 w-7 text-zinc-700" /><p className="mt-3 text-sm leading-6 text-zinc-500">{label}</p></div>;
}
