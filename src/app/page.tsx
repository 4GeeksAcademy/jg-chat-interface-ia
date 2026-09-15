"use client";

import { useState, useRef, useEffect, FormEvent } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface Meta {
  model: string;
  usage: Usage;
  responseTime: number;
}

const STORAGE_KEY = "jg_chat_messages";

function loadMessages(): Message[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<Meta | null>({ model: "qwen/qwen3.8-27b", usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, responseTime: 0 });
  const [mounted, setMounted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setMessages(loadMessages()); setMounted(true); }, []);
  useEffect(() => { if (mounted) localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); }, [messages, mounted]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const clearChat = () => { setMessages([]); setMeta(null); localStorage.removeItem(STORAGE_KEY); inputRef.current?.focus(); };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: Message = { role: "user", content: text };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: newMsgs }) });
      const data = await res.json();
      if (res.ok) {
        setMessages((p) => [...p, { role: "assistant", content: data.content }]);
        setMeta({ model: data.model, usage: data.usage, responseTime: data.responseTime });
      } else {
        setMessages((p) => [...p, { role: "assistant", content: `Error: ${data.error}` }]);
      }
    } catch { setMessages((p) => [...p, { role: "assistant", content: "Error de conexión." }]); }
    finally { setLoading(false); }
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-screen md:flex-row">
      {/* Chat */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center justify-between px-4 py-3 bg-lila-600 text-white shrink-0">
          <h1 className="text-lg font-bold">🤖 Chat IA</h1>
          <button onClick={clearChat} className="text-sm px-3 py-1 rounded bg-lila-800 hover:bg-lila-900 transition cursor-pointer">Limpiar conversación</button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-lila-50">
          {messages.length === 0 && <p className="text-center text-lila-400 mt-20 text-lg">Escribe un mensaje para comenzar…</p>}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] md:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === "user" ? "bg-lila-600 text-white rounded-br-md" : "bg-white text-gray-800 border border-lila-200 rounded-bl-md shadow-sm"}`}>
                <span className="block text-[10px] font-semibold mb-1 opacity-70">{msg.role === "user" ? "Tú" : "Agente"}</span>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-lila-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <span className="block text-[10px] font-semibold mb-1 opacity-70">Agente</span>
                <div className="flex gap-1.5">
                  <span className="typing-dot w-2 h-2 bg-lila-400 rounded-full inline-block" />
                  <span className="typing-dot w-2 h-2 bg-lila-400 rounded-full inline-block" />
                  <span className="typing-dot w-2 h-2 bg-lila-400 rounded-full inline-block" />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={send} className="flex gap-2 p-3 bg-white border-t border-lila-200 shrink-0">
          <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e); } }} placeholder="Escribe tu mensaje…" rows={1} className="flex-1 resize-none rounded-xl border border-lila-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lila-500" />
          <button type="submit" disabled={loading || !input.trim()} className="px-5 py-2.5 rounded-xl bg-lila-600 text-white font-semibold text-sm hover:bg-lila-700 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer">Enviar</button>
        </form>
      </div>
      {/* Panel lateral */}
      <aside className="w-full md:w-64 shrink-0 bg-lila-900 text-lila-100 p-4 flex flex-row md:flex-col gap-4 md:gap-6">
        {/* Modelo + Tiempo apilados */}
        <div className="flex flex-col gap-4 md:min-w-[140px]">
          <div>
            <h3 className="text-xs uppercase tracking-wider text-lila-400 mb-1">Modelo</h3>
            <p className="text-sm font-semibold break-all">{meta?.model || "—"}</p>
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-wider text-lila-400 mb-1">Tiempo</h3>
            <p className="text-sm font-semibold">{meta ? `${(meta.responseTime / 1000).toFixed(2)}s` : "—"}</p>
          </div>
        </div>
        {/* Tokens a la derecha en móvil, debajo en md+ */}
        <div className="md:min-w-[140px]">
          <h3 className="text-xs uppercase tracking-wider text-lila-400 mb-1">Tokens</h3>
          <p className="text-sm">Entrada: <span className="font-semibold">{meta?.usage.prompt_tokens ?? "—"}</span></p>
          <p className="text-sm">Salida: <span className="font-semibold">{meta?.usage.completion_tokens ?? "—"}</span></p>
          <p className="text-sm font-bold">Total: <span>{meta?.usage.total_tokens ?? "—"}</span></p>
        </div>
      </aside>
    </div>
  );
}
