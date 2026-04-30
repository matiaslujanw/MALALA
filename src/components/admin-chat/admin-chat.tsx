"use client";

import { useEffect, useRef, useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGERENCIAS = [
  "¿Qué sucursal facturó más este mes?",
  "Dame los 5 servicios más vendidos",
  "¿Hay stock crítico en alguna sucursal?",
  "¿Cómo viene la ocupación de turnos esta semana?",
];

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMarkdown(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/\*\*([^\n*]+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|[\s(])\*([^\n*]+?)\*(?=[\s).,!?:;]|$)/g, "$1<em>$2</em>");
  html = html.replace(/`([^`\n]+?)`/g, '<code class="rounded bg-stone-100 px-1 text-xs">$1</code>');
  html = html.replace(/\n/g, "<br/>");
  return html;
}

export function AdminChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toolLabel, setToolLabel] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading, toolLabel, open]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setToolLabel(null);

    try {
      const res = await fetch("/api/admin-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const block of events) {
          const lines = block.split("\n");
          const evLine = lines.find((l) => l.startsWith("event: "));
          const dataLine = lines.find((l) => l.startsWith("data: "));
          if (!evLine || !dataLine) continue;
          const event = evLine.slice(7).trim();
          const data = JSON.parse(dataLine.slice(6));

          if (event === "tool_call") {
            setToolLabel(`Consultando ${data.name}...`);
          } else if (event === "text") {
            assistantText = data.content;
          } else if (event === "error") {
            assistantText = `Error: ${data.message}`;
          }
        }
      }

      setMessages([
        ...next,
        { role: "assistant", content: assistantText || "(sin respuesta)" },
      ]);
    } catch (err) {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ]);
    } finally {
      setLoading(false);
      setToolLabel(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Cerrar asistente" : "Abrir asistente"}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:bg-sage-700"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <line x1="20" y1="4" x2="8.12" y2="15.88" />
            <line x1="14.47" y1="14.48" x2="20" y2="20" />
            <line x1="8.12" y1="8.12" x2="12" y2="12" />
          </svg>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[min(640px,80vh)] w-[min(420px,calc(100vw-3rem))] flex-col rounded-[1.5rem] border border-border bg-card shadow-2xl">
          <div className="flex items-start justify-between border-b border-border p-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                Auditoría IA
              </p>
              <h2 className="font-display text-lg tracking-[0.18em] uppercase">
                Asistente
              </h2>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                className="text-xs uppercase tracking-wider text-muted-foreground hover:text-ink"
              >
                Limpiar
              </button>
            )}
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Preguntale sobre turnos, ingresos, stock, empleados, caja.
                </p>
                {SUGERENCIAS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    disabled={loading}
                    className="w-full rounded-2xl border border-stone-200 bg-cream/60 px-3 py-2 text-left text-sm text-ink transition hover:border-sage-700 hover:bg-cream disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div
                  key={i}
                  className="ml-auto max-w-[85%] rounded-2xl bg-sage-700 px-3 py-2 text-sm text-primary-foreground"
                >
                  {m.content}
                </div>
              ) : (
                <div
                  key={i}
                  className="mr-auto max-w-[90%] rounded-2xl border border-stone-100 bg-cream/60 px-3 py-2 text-sm leading-relaxed text-ink [&_strong]:font-semibold [&_strong]:text-ink"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
                />
              ),
            )}

            {loading && (
              <div className="mr-auto max-w-[90%] rounded-2xl border border-dashed border-stone-200 bg-cream/40 px-3 py-2 text-xs text-muted-foreground">
                {toolLabel ?? "Pensando..."}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="border-t border-border p-3"
          >
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                placeholder="Hacé tu pregunta..."
                className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm focus:border-sage-700 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium uppercase tracking-wider text-primary-foreground transition hover:bg-sage-700 disabled:opacity-50"
              >
                Enviar
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
