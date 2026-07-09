import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getActiveSucursal, requireUser } from "@/lib/auth/session";
import { buildAccessScope } from "@/lib/auth/access";
import { toolsForRole, type ToolContext } from "@/lib/admin-chat/registry";
import { buildSystemPrompt } from "@/lib/admin-chat/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: Request) {
  const user = await requireUser();
  const scope = buildAccessScope(user);

  // El chatbot opera EXCLUSIVAMENTE sobre la sucursal activa de la sesión.
  const sucursalActiva = await getActiveSucursal();
  if (!sucursalActiva) {
    return NextResponse.json(
      { error: "No hay una sucursal activa en la sesión" },
      { status: 400 },
    );
  }
  const ctx: ToolContext = { sucursalId: sucursalActiva.id };

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY no configurada" },
      { status: 500 },
    );
  }

  const body = (await req.json()) as { messages: ChatMessage[] };
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "messages requerido" }, { status: 400 });
  }

  // Filtrar mensajes al historial permitido: solo user/assistant, contenido string, longitud acotada.
  const safeMessages = body.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content.slice(0, 20_000) : "",
    }))
    .filter((m) => m.content.length > 0);

  if (safeMessages.length === 0) {
    return NextResponse.json({ error: "messages requerido" }, { status: 400 });
  }

  const { defs: tools, entries } = toolsForRole(scope.rol);

  const client = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  });

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(scope.rol, sucursalActiva.nombre) },
    ...safeMessages,
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        const MAX_ITERATIONS = 8;
        for (let i = 0; i < MAX_ITERATIONS; i++) {
          const response = await client.chat.completions.create({
            model,
            messages,
            tools,
            tool_choice: "auto",
          });
          const msg = response.choices[0]?.message;
          if (!msg) {
            send("error", { message: "Respuesta vacía del modelo" });
            break;
          }

          messages.push(msg);

          if (msg.tool_calls && msg.tool_calls.length > 0) {
            // Si alguna tool es de escritura, NO la ejecutamos: pedimos
            // confirmación explícita al usuario (flujo de 2 fases).
            const writeCall = msg.tool_calls.find(
              (c) => c.type === "function" && entries[c.function.name]?.mode === "write",
            );
            if (writeCall && writeCall.type === "function") {
              const entry = entries[writeCall.function.name];
              let args: Record<string, unknown> = {};
              try {
                args = JSON.parse(writeCall.function.arguments || "{}");
              } catch {
                /* args inválidos: igual pedimos confirmación con lo que haya */
              }
              send("confirm_required", {
                tool: writeCall.function.name,
                args,
                resumen: entry?.summarize?.(args) ?? "Confirmar acción",
              });
              send("done", {});
              break;
            }

            for (const call of msg.tool_calls) {
              if (call.type !== "function") continue;
              const entry = entries[call.function.name];
              send("tool_call", { name: call.function.name });
              let result: unknown;
              try {
                if (!entry) throw new Error(`Tool no disponible: ${call.function.name}`);
                const args = JSON.parse(call.function.arguments || "{}");
                result = await entry.execute(args, ctx);
              } catch (err) {
                result = {
                  error: err instanceof Error ? err.message : String(err),
                };
              }
              messages.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify(result).slice(0, 50_000),
              });
            }
            continue;
          }

          if (msg.content) {
            send("text", { content: msg.content });
          }
          send("done", {});
          break;
        }
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
