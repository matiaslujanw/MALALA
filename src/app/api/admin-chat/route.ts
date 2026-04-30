import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireUser } from "@/lib/auth/session";
import { buildAccessScope } from "@/lib/auth/access";
import { listTurnos } from "@/lib/data/turnos";
import { listIngresos } from "@/lib/data/ingresos";
import { listEgresos } from "@/lib/data/egresos";
import { listStockBySucursal, listMovimientos } from "@/lib/data/stock";
import { listEmpleados } from "@/lib/data/empleados";
import { listSucursales } from "@/lib/data/sucursales";
import { listClientes } from "@/lib/data/clientes";
import { getAnalyticsSnapshot } from "@/lib/data/analytics";
import { getDashboardData } from "@/lib/data/dashboard";
import { getResumenDelDia } from "@/lib/data/caja";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `Sos un asistente analítico para administradores de MALALA, una cadena de salones de belleza. Tenés acceso a datos en tiempo real vía tools.

Reglas:
- Respondés en español rioplatense, breve y directo.
- SIEMPRE usás tools para conseguir datos antes de responder; no inventes números.
- Si una pregunta puede responderse con varios cortes, preguntá qué prefiere o asumí el más útil y aclaralo.
- Montos en pesos argentinos (formato $1.234,56). Fechas formato DD/MM/YYYY.
- Si no podés responder con los tools disponibles, decilo claramente.
- Sos read-only: no podés crear/modificar/eliminar nada. Si te piden eso, explicalo.
- Cuando muestres listas largas, resumí (top N) y ofrecé ver más.`;

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "list_sucursales",
      description: "Lista las sucursales del negocio. Útil para conocer IDs y nombres.",
      parameters: {
        type: "object",
        properties: {
          soloActivas: { type: "boolean", description: "Si solo las activas" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_empleados",
      description: "Lista empleados/profesionales con su sucursal y configuración de comisiones.",
      parameters: {
        type: "object",
        properties: {
          sucursalId: { type: "string" },
          incluirInactivos: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_clientes",
      description: "Lista clientes. Acepta búsqueda por nombre.",
      parameters: {
        type: "object",
        properties: {
          q: { type: "string", description: "Texto a buscar en nombre" },
          incluirInactivos: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_turnos",
      description: "Lista turnos (citas). Filtros opcionales por fecha (YYYY-MM-DD), sucursal, profesional, estado.",
      parameters: {
        type: "object",
        properties: {
          fecha: { type: "string", description: "YYYY-MM-DD" },
          sucursalId: { type: "string" },
          profesionalId: { type: "string" },
          estado: {
            type: "string",
            enum: ["pendiente", "confirmado", "en_curso", "completado", "cancelado", "ausente"],
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_ingresos",
      description: "Lista ingresos/ventas con filtros por sucursal, empleado, cliente y rango de fechas (ISO).",
      parameters: {
        type: "object",
        properties: {
          sucursalId: { type: "string" },
          empleadoId: { type: "string" },
          clienteId: { type: "string" },
          desde: { type: "string", description: "ISO date" },
          hasta: { type: "string", description: "ISO date" },
          incluirAnulados: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_egresos",
      description: "Lista egresos/gastos. Filtros por sucursal, rubro, proveedor, rango y soloPendientes.",
      parameters: {
        type: "object",
        properties: {
          sucursalId: { type: "string" },
          rubroId: { type: "string" },
          proveedorId: { type: "string" },
          desde: { type: "string" },
          hasta: { type: "string" },
          soloPendientes: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_stock",
      description: "Lista stock de insumos en una sucursal específica.",
      parameters: {
        type: "object",
        properties: {
          sucursalId: { type: "string", description: "ID de sucursal (requerido)" },
        },
        required: ["sucursalId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_movimientos_stock",
      description: "Últimos movimientos de stock (compras, ventas, ajustes, transferencias).",
      parameters: {
        type: "object",
        properties: {
          sucursalId: { type: "string" },
          insumoId: { type: "string" },
          limit: { type: "number", description: "Default 50" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_analytics",
      description: "Snapshot analítico consolidado: KPIs (ingresos, neto, ocupación, cancelaciones), distribución por sucursal/profesional/servicio, stock crítico. Acepta filtros de rango y sucursal.",
      parameters: {
        type: "object",
        properties: {
          desde: { type: "string", description: "YYYY-MM-DD" },
          hasta: { type: "string", description: "YYYY-MM-DD" },
          sucursalId: { type: "string" },
          empleadoId: { type: "string" },
          rubro: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_dashboard",
      description: "Dashboard de una sucursal: ventas hoy/mes, tickets, comisiones, stock crítico, top servicios y empleados.",
      parameters: {
        type: "object",
        properties: {
          sucursalId: { type: "string" },
        },
        required: ["sucursalId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_resumen_caja",
      description: "Resumen del día de caja para una sucursal: medios de pago, tickets, comisiones por empleado.",
      parameters: {
        type: "object",
        properties: {
          sucursalId: { type: "string" },
          fecha: { type: "string", description: "YYYY-MM-DD; default hoy" },
        },
        required: ["sucursalId"],
      },
    },
  },
];

async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "list_sucursales":
      return listSucursales({ soloActivas: args.soloActivas as boolean });
    case "list_empleados":
      return listEmpleados({
        sucursalId: args.sucursalId as string | undefined,
        incluirInactivos: args.incluirInactivos as boolean | undefined,
      });
    case "list_clientes":
      return (
        await listClientes({
          q: args.q as string | undefined,
          incluirInactivos: args.incluirInactivos as boolean | undefined,
        })
      ).slice(0, 100);
    case "list_turnos":
      return (
        await listTurnos({
          fecha: args.fecha as string | undefined,
          sucursalId: args.sucursalId as string | undefined,
          profesionalId: args.profesionalId as string | undefined,
          estado: args.estado as string | undefined,
        })
      ).slice(0, 200);
    case "list_ingresos":
      return (await listIngresos(args)).slice(0, 200);
    case "list_egresos":
      return (await listEgresos(args)).slice(0, 200);
    case "list_stock":
      return listStockBySucursal(args.sucursalId as string);
    case "list_movimientos_stock":
      return listMovimientos({
        sucursalId: args.sucursalId as string | undefined,
        insumoId: args.insumoId as string | undefined,
        limit: (args.limit as number | undefined) ?? 50,
      });
    case "get_analytics":
      return getAnalyticsSnapshot(args);
    case "get_dashboard":
      return getDashboardData(args.sucursalId as string);
    case "get_resumen_caja":
      return getResumenDelDia({
        sucursalId: args.sucursalId as string,
        fecha: args.fecha as string | undefined,
      });
    default:
      return { error: `Tool desconocida: ${name}` };
  }
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: Request) {
  const user = await requireUser();
  const scope = buildAccessScope(user);
  if (scope.rol !== "admin") {
    return NextResponse.json({ error: "Solo admin" }, { status: 403 });
  }

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

  const client = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  });

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...body.messages.map((m) => ({ role: m.role, content: m.content })),
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
            for (const call of msg.tool_calls) {
              if (call.type !== "function") continue;
              send("tool_call", { name: call.function.name });
              let result: unknown;
              try {
                const args = JSON.parse(call.function.arguments || "{}");
                result = await executeTool(call.function.name, args);
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
