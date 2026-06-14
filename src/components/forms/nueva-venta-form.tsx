"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, AlertTriangle, Scissors, Package, CreditCard } from "lucide-react";
import { createIngreso } from "@/lib/data/ingresos-actions";
import { createClienteQuick } from "@/lib/data/clientes";
import type {
  Cliente,
  CuentaBancaria,
  Empleado,
  Insumo,
  MedioPago,
  MotivoDescuento,
  Servicio,
} from "@/lib/types";
import { formatARS } from "@/lib/utils";
import { CurrencyInput } from "@/components/forms/currency-input";
import { ClienteCombobox } from "@/components/forms/cliente-combobox";

type LineaServicioForm = {
  tempId: string;
  tipo: "servicio";
  servicio_id: string;
  empleado_id: string;
  precio: number;
  precio_tipo: "lista" | "efectivo";
  comision_pct: number;
  soporta_descuento: boolean;
};

type LineaProductoForm = {
  tempId: string;
  tipo: "producto";
  insumo_id: string;
  cantidad: number;
  precio: number;
};

type LineaForm = LineaServicioForm | LineaProductoForm;

interface Props {
  sucursalId: string;
  sucursalNombre: string;
  clientes: Cliente[];
  servicios: Servicio[];
  empleados: Empleado[];
  mediosPago: MedioPago[];
  productos: Insumo[];
  motivosDescuento: MotivoDescuento[];
  cuentasBanco: CuentaBancaria[];
}

const newLineaServicio = (): LineaServicioForm => ({
  tempId: crypto.randomUUID(),
  tipo: "servicio",
  servicio_id: "",
  empleado_id: "",
  precio: 0,
  precio_tipo: "lista",
  comision_pct: 30,
  soporta_descuento: true,
});

// ¿El medio de pago es una transferencia? (habilita elegir banco destino)
function esTransferencia(mp: MedioPago | undefined): boolean {
  if (!mp) return false;
  return (
    mp.codigo.toUpperCase().startsWith("TR") ||
    mp.nombre.toLowerCase().includes("transfer")
  );
}

const newLineaProducto = (): LineaProductoForm => ({
  tempId: crypto.randomUUID(),
  tipo: "producto",
  insumo_id: "",
  cantidad: 1,
  precio: 0,
});

function subtotalLinea(l: LineaForm): number {
  const precio = Number(l.precio) || 0;
  if (l.tipo === "producto") return precio * (Number(l.cantidad) || 0);
  return precio;
}

// Comisión de una línea de servicio, reflejando la regla del servidor:
//   soporta_descuento = true  → comisión sobre el precio final pagado (desc. prorrateado)
//   soporta_descuento = false → comisión sobre el precio de lista (regular)
function comisionLineaServicio(
  l: LineaServicioForm,
  precioLista: number,
  subtotalLineas: number,
  descMonto: number,
): number {
  const sub = Number(l.precio) || 0;
  const descProrrateado =
    subtotalLineas > 0 ? descMonto * (sub / subtotalLineas) : 0;
  const base = l.soporta_descuento ? sub - descProrrateado : precioLista;
  return base * ((Number(l.comision_pct) || 0) / 100);
}

export function NuevaVentaForm({
  sucursalId,
  sucursalNombre,
  clientes,
  servicios,
  empleados,
  mediosPago,
  productos,
  motivosDescuento,
  cuentasBanco,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Header
  const [clientesList, setClientesList] = useState<Cliente[]>(clientes);
  const [clienteId, setClienteId] = useState("");
  const [observacion, setObservacion] = useState("");

  // Modal nuevo cliente
  const [showNewCliente, setShowNewCliente] = useState(false);
  const [newClienteNombre, setNewClienteNombre] = useState("");
  const [newClienteTel, setNewClienteTel] = useState("");
  const [newClienteSaving, setNewClienteSaving] = useState(false);
  const [newClienteError, setNewClienteError] = useState<string | null>(null);
  const newClienteNombreRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showNewCliente) {
      setTimeout(() => newClienteNombreRef.current?.focus(), 50);
    }
  }, [showNewCliente]);

  async function handleCreateCliente() {
    setNewClienteError(null);
    const nombre = newClienteNombre.trim();
    if (!nombre) {
      setNewClienteError("Nombre requerido");
      return;
    }
    setNewClienteSaving(true);
    try {
      const res = await createClienteQuick({
        nombre,
        telefono: newClienteTel.trim() || undefined,
      });
      if (!res.ok) {
        setNewClienteError(
          Object.values(res.errors).flat().join(", ") || "Error al crear",
        );
        return;
      }
      setClientesList((prev) =>
        [...prev, res.cliente].sort((a, b) => a.nombre.localeCompare(b.nombre)),
      );
      setClienteId(res.cliente.id);
      // Un cliente recién creado no tiene CC: si había un medio en CC, lo reseteamos.
      if (medioCc) {
        if (mp1Id === medioCc.id) {
          setMp1Id(efectivo?.id ?? mediosNormales[0]?.id ?? "");
        }
        if (mp2Id === medioCc.id) setMp2Id("");
      }
      setShowNewCliente(false);
      setNewClienteNombre("");
      setNewClienteTel("");
    } catch (e) {
      setNewClienteError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setNewClienteSaving(false);
    }
  }

  // Líneas
  const [lineas, setLineas] = useState<LineaForm[]>([newLineaServicio()]);

  // Descuento
  const [descTipo, setDescTipo] = useState<"pct" | "monto">("pct");
  const [descValor, setDescValor] = useState(0);
  const [descMotivoId, setDescMotivoId] = useState("");

  // Cuenta corriente: el medio con código "CC" es especial (genera deuda, no
  // entra a bancos) y solo se ofrece si el cliente elegido tiene CC habilitada.
  const medioCc = mediosPago.find((m) => m.codigo === "CC");
  const mediosNormales = mediosPago.filter((m) => m.codigo !== "CC");

  // Pagos
  const efectivo = mediosNormales.find((m) => m.codigo === "EF");
  const [mp1Id, setMp1Id] = useState(
    efectivo?.id ?? mediosNormales[0]?.id ?? "",
  );
  const [valor1, setValor1] = useState<number>(0);
  const [mp1CuentaId, setMp1CuentaId] = useState("");
  const [mp2Id, setMp2Id] = useState("");
  const [valor2, setValor2] = useState<number>(0);
  const [mp2CuentaId, setMp2CuentaId] = useState("");

  // Resultado server
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [warnings, setWarnings] = useState<string[]>([]);

  // ----- Cálculos derivados -----
  const subtotal = lineas.reduce((acc, l) => acc + subtotalLinea(l), 0);
  const descMonto =
    descTipo === "pct"
      ? subtotal * (Number(descValor) / 100)
      : Number(descValor) || 0;
  const total = Math.max(0, subtotal - descMonto); // neto de servicios/productos (antes de recargo)

  const comisionDe = (l: LineaServicioForm) => {
    const s = servicios.find((x) => x.id === l.servicio_id);
    return comisionLineaServicio(
      l,
      s?.precio_lista ?? (Number(l.precio) || 0),
      subtotal,
      descMonto,
    );
  };
  const totalComisiones = lineas.reduce(
    (acc, l) => (l.tipo === "servicio" ? acc + comisionDe(l) : acc),
    0,
  );
  const paraElLocal = total - totalComisiones;

  // Cliente seleccionado y si admite cuenta corriente.
  const clienteSel = clientesList.find((c) => c.id === clienteId);
  const clienteTieneCc =
    !!medioCc && !!clienteSel?.cuenta_corriente_habilitada;
  const mp1EsCc = !!medioCc && mp1Id === medioCc.id;
  const mp2EsCc = !!medioCc && mp2Id === medioCc.id;
  const usaCc = mp1EsCc || mp2EsCc;
  const montoFiado =
    (mp1EsCc ? Number(valor1) || 0 : 0) + (mp2EsCc ? Number(valor2) || 0 : 0);

  // Recargo automático por medio de pago (ej. tarjeta de crédito).
  const mp1 = mediosPago.find((m) => m.id === mp1Id);
  const mp2 = mp2Id ? mediosPago.find((m) => m.id === mp2Id) : undefined;
  const recargo1 = (Number(valor1) || 0) * ((mp1?.recargo_pct ?? 0) / 100);
  const recargo2 = mp2 ? (Number(valor2) || 0) * ((mp2.recargo_pct ?? 0) / 100) : 0;
  const recargoTotal = recargo1 + recargo2;
  const totalACobrar = total + recargoTotal;

  const pagado = (Number(valor1) || 0) + (Number(valor2) || 0);
  const diff = total - pagado;
  const pagosOk = Math.abs(diff) < 0.01;

  // Aviso (no bloquea): descuento manual + línea a precio efectivo = 20% + otro descuento.
  const hayLineaEfectivo = lineas.some(
    (l) => l.tipo === "servicio" && l.precio_tipo === "efectivo",
  );
  const avisoDobleDescuento = descMonto > 0 && hayLineaEfectivo;

  // Comisiones por empleado en este ticket
  const comisionPorEmpleado = lineas.reduce<
    Map<string, { nombre: string; total: number; lineas: number }>
  >((acc, l) => {
    if (l.tipo !== "servicio" || !l.empleado_id) return acc;
    const emp = empleados.find((e) => e.id === l.empleado_id);
    if (!emp) return acc;
    const com = comisionDe(l);
    const cur = acc.get(emp.id) ?? { nombre: emp.nombre, total: 0, lineas: 0 };
    cur.total += com;
    cur.lineas += 1;
    acc.set(emp.id, cur);
    return acc;
  }, new Map());
  const repartoEmpleados = Array.from(comisionPorEmpleado.values()).sort(
    (a, b) => b.total - a.total,
  );

  // Cuando no hay mp2, valor1 = total automáticamente
  useEffect(() => {
    if (!mp2Id) {
      setValor1(total);
      setValor2(0);
    } else {
      setValor2(Math.max(0, total - (Number(valor1) || 0)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, mp2Id]);

  // ----- Helpers de líneas -----
  function updateLinea(idx: number, patch: Partial<LineaForm>) {
    setLineas((prev) =>
      prev.map((l, i) => (i === idx ? ({ ...l, ...patch } as LineaForm) : l)),
    );
  }

  function handleServicioChange(idx: number, servicioId: string) {
    const l = lineas[idx];
    if (l.tipo !== "servicio") return;
    const s = servicios.find((x) => x.id === servicioId);
    if (!s) {
      updateLinea(idx, { servicio_id: "" });
      return;
    }
    const empleado = empleados.find((e) => e.id === l.empleado_id);
    updateLinea(idx, {
      servicio_id: servicioId,
      precio: l.precio_tipo === "efectivo" ? s.precio_efectivo : s.precio_lista,
      comision_pct: empleado?.porcentaje_default ?? s.comision_default_pct,
    });
  }

  function handlePrecioTipoChange(idx: number, tipo: "lista" | "efectivo") {
    const l = lineas[idx];
    if (l.tipo !== "servicio") return;
    const s = servicios.find((x) => x.id === l.servicio_id);
    updateLinea(idx, {
      precio_tipo: tipo,
      precio: s ? (tipo === "efectivo" ? s.precio_efectivo : s.precio_lista) : l.precio,
    });
  }

  function handleEmpleadoChange(idx: number, empleadoId: string) {
    const l = lineas[idx];
    if (l.tipo !== "servicio") return;
    const e = empleados.find((x) => x.id === empleadoId);
    updateLinea(idx, {
      empleado_id: empleadoId,
      comision_pct: e?.porcentaje_default ?? l.comision_pct,
    });
  }

  function handleProductoChange(idx: number, insumoId: string) {
    const l = lineas[idx];
    if (l.tipo !== "producto") return;
    const p = productos.find((x) => x.id === insumoId);
    if (!p) {
      updateLinea(idx, { insumo_id: "" });
      return;
    }
    updateLinea(idx, {
      insumo_id: insumoId,
      precio: p.precio_venta ?? 0,
    });
  }

  function addLineaServicio() {
    setLineas((prev) => [...prev, newLineaServicio()]);
  }

  function addLineaProducto() {
    setLineas((prev) => [...prev, newLineaProducto()]);
  }

  function removeLinea(idx: number) {
    setLineas((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  // Si un medio estaba en CC y el cliente ya no admite cuenta corriente, lo
  // reseteamos para no dejar una venta fiada a un cliente sin CC.
  function resetCcSiNoCorresponde(nuevoClienteId: string) {
    if (!medioCc) return;
    const nuevo = clientesList.find((c) => c.id === nuevoClienteId);
    if (nuevo?.cuenta_corriente_habilitada) return;
    if (mp1Id === medioCc.id) {
      setMp1Id(efectivo?.id ?? mediosNormales[0]?.id ?? "");
    }
    if (mp2Id === medioCc.id) setMp2Id("");
  }

  function handleClienteChange(nuevoId: string) {
    setClienteId(nuevoId);
    resetCcSiNoCorresponde(nuevoId);
  }

  // ----- Submit -----
  function handleSubmit(formData: FormData) {
    setErrors({});
    setWarnings([]);

    // Validación cliente-side mínima
    const lineaInvalida = lineas.some((l) => {
      if (l.tipo === "servicio") return !l.servicio_id || !l.empleado_id;
      return !l.insumo_id || !(Number(l.cantidad) > 0);
    });
    if (lineaInvalida) {
      setErrors({
        lineas: [
          "Revisá las líneas: los servicios necesitan servicio + empleado y los productos necesitan producto + cantidad > 0",
        ],
      });
      return;
    }

    formData.set("sucursal_id", sucursalId);
    formData.set("cliente_id", clienteId);
    formData.set(
      "lineas",
      JSON.stringify(
        lineas.map((l) => {
          if (l.tipo === "producto") {
            return {
              tipo: "producto" as const,
              insumo_id: l.insumo_id,
              cantidad: Number(l.cantidad) || 0,
              precio_efectivo: Number(l.precio) || 0,
            };
          }
          return {
            tipo: "servicio" as const,
            servicio_id: l.servicio_id,
            empleado_id: l.empleado_id,
            precio_efectivo: Number(l.precio) || 0,
            comision_pct: Number(l.comision_pct) || 0,
            soporta_descuento: l.soporta_descuento,
          };
        }),
      ),
    );
    formData.set("descuento_tipo", descTipo);
    formData.set("descuento_valor", String(Number(descValor) || 0));
    formData.set("descuento_motivo_id", descMonto > 0 ? descMotivoId : "");
    formData.set("mp1_id", mp1Id);
    formData.set("valor1", String(Number(valor1) || 0));
    formData.set(
      "mp1_cuenta_id",
      esTransferencia(mp1) ? mp1CuentaId : "",
    );
    if (mp2Id) {
      formData.set("mp2_id", mp2Id);
      formData.set("valor2", String(Number(valor2) || 0));
      formData.set(
        "mp2_cuenta_id",
        esTransferencia(mp2) ? mp2CuentaId : "",
      );
    }
    formData.set("observacion", observacion);

    startTransition(async () => {
      const result = await createIngreso(formData);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      if (result.warnings) {
        setWarnings(result.warnings);
        setTimeout(() => {
          if (result.ingresoId) router.push(`/ventas/${result.ingresoId}`);
        }, 1500);
        return;
      }
      if (result.ingresoId) {
        router.push(`/ventas/${result.ingresoId}`);
      }
    });
  }

  const empleadosActivos = empleados.filter((e) => e.activo);
  const serviciosActivos = servicios.filter((s) => s.activo);

  const nServicios = lineas.filter((l) => l.tipo === "servicio").length;
  const nProductos = lineas.filter((l) => l.tipo === "producto").length;

  return (
    <>
    <form action={handleSubmit} className="space-y-8">
      {/* Header: cliente + sucursal info */}
      <section className="bg-card border border-border rounded-md p-5 space-y-4">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Datos del ticket
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Cliente
            </label>
            <div className="flex gap-2">
              <ClienteCombobox
                clientes={clientesList}
                value={clienteId}
                onChange={handleClienteChange}
              />
              <button
                type="button"
                onClick={() => setShowNewCliente(true)}
                className="px-3 py-2 border border-border rounded-md text-xs uppercase tracking-wider hover:bg-cream transition-colors whitespace-nowrap"
              >
                + Nuevo
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Sucursal
            </label>
            <div className="px-3 py-2 border border-border rounded-md bg-cream/40 text-sm">
              {sucursalNombre}
            </div>
          </div>
        </div>
      </section>

      {/* Líneas */}
      <section className="space-y-3">
        <div className="flex items-end justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
              Líneas del ticket
            </h2>
            {nServicios > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sage-100 text-sage-800">
                <Scissors className="h-3 w-3 stroke-[1.5]" />
                {nServicios} servicio{nServicios !== 1 ? "s" : ""}
              </span>
            )}
            {nProductos > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">
                <Package className="h-3 w-3 stroke-[1.5]" />
                {nProductos} producto{nProductos !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={addLineaServicio}
              className="inline-flex items-center gap-1.5 rounded-md bg-sage-700 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-white hover:bg-sage-900 transition-colors"
            >
              <Scissors className="h-3.5 w-3.5 stroke-[1.5]" />
              Agregar servicio
            </button>
            <button
              type="button"
              onClick={addLineaProducto}
              disabled={productos.length === 0}
              title={
                productos.length === 0
                  ? "No hay productos cargados como vendibles en stock"
                  : undefined
              }
              className="inline-flex items-center gap-1.5 rounded-md border border-sage-700 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-sage-700 hover:bg-sage-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Package className="h-3.5 w-3.5 stroke-[1.5]" />
              Agregar producto
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {lineas.map((l, idx) => (
            <div
              key={l.tempId}
              className={`bg-card border border-border rounded-md p-3 border-l-4 ${
                l.tipo === "servicio"
                  ? "border-l-sage-700"
                  : "border-l-amber-500"
              }`}
            >
              {l.tipo === "servicio" ? (
                <LineaServicioRow
                  linea={l}
                  servicios={serviciosActivos}
                  empleados={empleadosActivos}
                  comision={comisionDe(l)}
                  onServicio={(id) => handleServicioChange(idx, id)}
                  onEmpleado={(id) => handleEmpleadoChange(idx, id)}
                  onPrecio={(v) => updateLinea(idx, { precio: v })}
                  onPrecioTipo={(t) => handlePrecioTipoChange(idx, t)}
                  onSoporta={(v) => updateLinea(idx, { soporta_descuento: v })}
                  onRemove={() => removeLinea(idx)}
                  removable={lineas.length > 1}
                />
              ) : (
                <LineaProductoRow
                  linea={l}
                  productos={productos}
                  onProducto={(id) => handleProductoChange(idx, id)}
                  onCantidad={(v) => updateLinea(idx, { cantidad: v })}
                  onPrecio={(v) => updateLinea(idx, { precio: v })}
                  onRemove={() => removeLinea(idx)}
                  removable={lineas.length > 1}
                />
              )}
            </div>
          ))}
        </div>

        {errors.lineas && (
          <p className="text-xs text-destructive">{errors.lineas.join(", ")}</p>
        )}
      </section>

      {/* Resumen + descuento + pagos en grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Descuento */}
        <section className="bg-card border border-border rounded-md p-5 space-y-4">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
            Descuento
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Tipo
              </label>
              <select
                value={descTipo}
                onChange={(e) =>
                  setDescTipo(e.target.value as "pct" | "monto")
                }
                className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
              >
                <option value="pct">Porcentaje (%)</option>
                <option value="monto">Monto ($)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Valor
              </label>
              {descTipo === "monto" ? (
                <CurrencyInput
                  value={descValor}
                  onChange={setDescValor}
                  min={0}
                  className="w-full px-3 py-2 text-right tabular-nums border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              ) : (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={descValor}
                  onChange={(e) => setDescValor(Number(e.target.value))}
                  className="w-full px-3 py-2 text-right tabular-nums border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              )}
            </div>
          </div>
          {errors.descuento_valor && (
            <p className="text-xs text-destructive">
              {errors.descuento_valor.join(", ")}
            </p>
          )}
          {descMonto > 0 && (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Motivo del descuento *
              </label>
              {motivosDescuento.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No hay motivos cargados. Pedí a un administrador que los cree en
                  Catálogos → Motivos de descuento.
                </p>
              ) : (
                <select
                  value={descMotivoId}
                  onChange={(e) => setDescMotivoId(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">— Elegí un motivo —</option>
                  {motivosDescuento.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </select>
              )}
              {errors.descuento_motivo_id && (
                <p className="text-xs text-destructive">
                  {errors.descuento_motivo_id.join(", ")}
                </p>
              )}
              <p className="text-xs text-muted-foreground tabular-nums">
                Descuento aplicado: {formatARS(descMonto)}
              </p>
            </div>
          )}
        </section>

        {/* Resumen / totales con reparto */}
        <section className="bg-cream/40 border border-border rounded-md p-5 space-y-3 text-sm">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
            Resumen y reparto
          </h2>

          <div className="space-y-1.5">
            <div className="flex justify-between tabular-nums">
              <span>Subtotal</span>
              <span>{formatARS(subtotal)}</span>
            </div>
            {descMonto > 0 && (
              <div className="flex justify-between tabular-nums text-muted-foreground">
                <span>Descuento</span>
                <span>− {formatARS(descMonto)}</span>
              </div>
            )}
            <div className="flex justify-between font-display text-2xl pt-2 border-t border-border tabular-nums">
              <span>Total</span>
              <span>{formatARS(total)}</span>
            </div>
          </div>

          {/* Reparto: empleados + local */}
          <div className="pt-3 border-t border-border space-y-1.5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Reparto del ticket
            </p>

            {repartoEmpleados.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Asigná empleados a las líneas de servicio para ver el reparto.
              </p>
            ) : (
              repartoEmpleados.map((r) => (
                <div
                  key={r.nombre}
                  className="flex justify-between items-center tabular-nums text-sm"
                >
                  <span>
                    {r.nombre}
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      · {r.lineas} línea{r.lineas !== 1 ? "s" : ""}
                    </span>
                  </span>
                  <span style={{ color: "var(--sage-700)" }}>
                    {formatARS(r.total)}
                  </span>
                </div>
              ))
            )}

            <div
              className="flex justify-between items-center pt-2 mt-2 border-t border-border tabular-nums"
              style={{ borderTopStyle: "dashed" }}
            >
              <span className="text-xs uppercase tracking-wider font-medium">
                Para el local
              </span>
              <span
                className="font-display text-xl"
                style={{
                  color:
                    paraElLocal >= 0 ? "var(--ink)" : "var(--danger)",
                }}
              >
                {formatARS(paraElLocal)}
              </span>
            </div>

            {total > 0 && repartoEmpleados.length > 0 && (
              <p className="text-[10px] text-muted-foreground tabular-nums pt-1">
                Equipo {((totalComisiones / total) * 100).toFixed(0)}% · Local{" "}
                {((paraElLocal / total) * 100).toFixed(0)}%
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Aviso: doble descuento (no bloquea) */}
      {avisoDobleDescuento && (
        <div
          className="border rounded-md p-4 flex items-start gap-3"
          style={{
            backgroundColor: "rgb(201 169 97 / 0.08)",
            borderColor: "var(--warning)",
          }}
        >
          <AlertTriangle
            className="h-5 w-5 stroke-[1.5] shrink-0"
            style={{ color: "var(--warning)" }}
          />
          <div className="space-y-0.5 text-sm">
            <p className="font-medium" style={{ color: "var(--warning)" }}>
              Cuidado: estás acumulando descuentos
            </p>
            <p className="text-xs text-muted-foreground">
              Hay líneas a precio <strong>Efectivo</strong> (que ya incluye el
              descuento del 20%) y además aplicaste un descuento manual. Revisá
              que no estés sumando los dos descuentos. Si el cliente tiene el
              descuento manual, las líneas deberían ir a precio de{" "}
              <strong>Lista</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Pagos */}
      <section className="bg-card border border-border rounded-md p-5 space-y-4">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Medios de pago
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Medio 1
            </label>
            <select
              value={mp1Id}
              onChange={(e) => setMp1Id(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
              required
            >
              {mediosNormales.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.codigo} — {m.nombre}
                </option>
              ))}
              {clienteTieneCc && medioCc && (
                <option value={medioCc.id}>CC — Cuenta corriente</option>
              )}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Valor 1
            </label>
            <CurrencyInput
              value={valor1}
              min={0}
              onChange={(v) => {
                setValor1(v);
                if (mp2Id) setValor2(Math.max(0, total - v));
              }}
              className="w-full px-3 py-2 text-right tabular-nums border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {recargo1 > 0 && (
              <p className="text-[10px] text-amber-700 tabular-nums">
                + recargo {mp1?.recargo_pct}% = {formatARS(valor1 + recargo1)} a cobrar
              </p>
            )}
          </div>
        </div>

        {esTransferencia(mp1) && (
          <BancoSelector
            cuentas={cuentasBanco}
            value={mp1CuentaId}
            onChange={setMp1CuentaId}
            label="Banco de la transferencia (Medio 1)"
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Medio 2 (opcional)
            </label>
            <select
              value={mp2Id}
              onChange={(e) => {
                const v = e.target.value;
                setMp2Id(v);
                if (!v) {
                  setValor1(total);
                  setValor2(0);
                } else {
                  setValor2(Math.max(0, total - (Number(valor1) || 0)));
                }
              }}
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
            >
              <option value="">— Ninguno —</option>
              {mediosNormales
                .filter((m) => m.id !== mp1Id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.codigo} — {m.nombre}
                  </option>
                ))}
              {clienteTieneCc && medioCc && !mp1EsCc && (
                <option value={medioCc.id}>CC — Cuenta corriente</option>
              )}
            </select>
          </div>
          {mp2Id && (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Valor 2
              </label>
              <CurrencyInput
                value={valor2}
                min={0}
                onChange={(v) => {
                  setValor2(v);
                  setValor1(Math.max(0, total - v));
                }}
                className="w-full px-3 py-2 text-right tabular-nums border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {recargo2 > 0 && (
                <p className="text-[10px] text-amber-700 tabular-nums">
                  + recargo {mp2?.recargo_pct}% = {formatARS(valor2 + recargo2)} a cobrar
                </p>
              )}
            </div>
          )}
        </div>

        {mp2Id && esTransferencia(mp2) && (
          <BancoSelector
            cuentas={cuentasBanco}
            value={mp2CuentaId}
            onChange={setMp2CuentaId}
            label="Banco de la transferencia (Medio 2)"
          />
        )}

        <div className="flex items-center justify-between pt-3 border-t border-border text-sm tabular-nums">
          <span className="text-muted-foreground">Pagado · Total · Diferencia</span>
          <span>
            {formatARS(pagado)} · {formatARS(total)} ·{" "}
            <span
              style={{
                color: pagosOk
                  ? "var(--sage-700)"
                  : "var(--danger)",
              }}
            >
              {formatARS(diff)}
            </span>
          </span>
        </div>
        {recargoTotal > 0 && (
          <div className="flex items-center justify-between text-sm tabular-nums">
            <span className="text-amber-700 uppercase tracking-wider text-xs">
              Recargo · Total a cobrar
            </span>
            <span className="text-amber-700">
              + {formatARS(recargoTotal)} ·{" "}
              <span className="font-display text-lg text-foreground">
                {formatARS(totalACobrar)}
              </span>
            </span>
          </div>
        )}
        {errors.valor1 && (
          <p className="text-xs text-destructive">{errors.valor1.join(", ")}</p>
        )}

        {usaCc && montoFiado > 0 && (
          <div
            className="border rounded-md p-3 flex items-start gap-2.5 text-sm"
            style={{
              backgroundColor: "rgb(201 169 97 / 0.08)",
              borderColor: "var(--warning)",
            }}
          >
            <CreditCard
              className="h-4 w-4 stroke-[1.5] shrink-0 mt-0.5"
              style={{ color: "var(--warning)" }}
            />
            <p className="text-xs">
              Se generará una deuda de{" "}
              <strong className="tabular-nums">{formatARS(montoFiado)}</strong> en
              la cuenta corriente de{" "}
              <strong>{clienteSel?.nombre ?? "el cliente"}</strong>. Esta parte no
              entra a bancos hasta que se salde.
            </p>
          </div>
        )}
      </section>

      {/* Observación */}
      <section className="space-y-1.5">
        <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Observación
        </label>
        <textarea
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </section>

      {/* Warnings de stock */}
      {warnings.length > 0 && (
        <div
          className="border rounded-md p-4 flex items-start gap-3"
          style={{
            backgroundColor: "rgb(201 169 97 / 0.08)",
            borderColor: "var(--warning)",
          }}
        >
          <AlertTriangle
            className="h-5 w-5 stroke-[1.5] shrink-0"
            style={{ color: "var(--warning)" }}
          />
          <div className="space-y-1 text-sm">
            <p className="font-medium" style={{ color: "var(--warning)" }}>
              Venta guardada con advertencias de stock
            </p>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground pt-1">
              Redirigiendo al detalle…
            </p>
          </div>
        </div>
      )}

      {/* Errores globales / cualquier error no mostrado inline */}
      {Object.keys(errors).length > 0 && (
        <div className="bg-destructive/10 border border-destructive rounded-md p-4 text-sm text-destructive space-y-1">
          <p className="font-medium">No se pudo guardar la venta:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {Object.entries(errors).flatMap(([campo, msgs]) =>
              (msgs ?? []).map((m, i) => (
                <li key={`${campo}-${i}`}>{m}</li>
              )),
            )}
          </ul>
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending || !pagosOk || lineas.length === 0}
          className="bg-primary text-primary-foreground px-6 py-2.5 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? "Guardando…" : "Guardar venta"}
        </button>
        {!pending && !pagosOk && (
          <span className="text-xs text-destructive">
            La suma de pagos no coincide con el total ({formatARS(diff)} de
            diferencia).
          </span>
        )}
        <Link
          href="/ventas"
          className="px-4 py-2.5 rounded-md text-sm font-medium border border-border hover:bg-cream transition-colors"
        >
          Cancelar
        </Link>
      </div>
    </form>

    {showNewCliente && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={() => !newClienteSaving && setShowNewCliente(false)}
      >
        <div
          className="bg-card border border-border rounded-md shadow-lg w-full max-w-md p-6 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between">
            <h3 className="font-display text-lg tracking-[0.15em] uppercase">
              Nuevo cliente
            </h3>
            <button
              type="button"
              onClick={() => setShowNewCliente(false)}
              disabled={newClienteSaving}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4 stroke-[1.5]" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Nombre *
              </label>
              <input
                ref={newClienteNombreRef}
                type="text"
                value={newClienteNombre}
                onChange={(e) => setNewClienteNombre(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateCliente();
                  }
                }}
                className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Teléfono
              </label>
              <input
                type="tel"
                value={newClienteTel}
                onChange={(e) => setNewClienteTel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateCliente();
                  }
                }}
                className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {newClienteError && (
            <p className="text-xs text-destructive">{newClienteError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowNewCliente(false)}
              disabled={newClienteSaving}
              className="px-4 py-2 rounded-md text-sm font-medium border border-border hover:bg-cream transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreateCliente}
              disabled={newClienteSaving}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 disabled:opacity-50 transition-colors"
            >
              {newClienteSaving ? "Guardando…" : "Crear"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function LineaServicioRow({
  linea,
  servicios,
  empleados,
  comision,
  onServicio,
  onEmpleado,
  onPrecio,
  onPrecioTipo,
  onSoporta,
  onRemove,
  removable,
}: {
  linea: LineaServicioForm;
  servicios: Servicio[];
  empleados: Empleado[];
  comision: number;
  onServicio: (id: string) => void;
  onEmpleado: (id: string) => void;
  onPrecio: (v: number) => void;
  onPrecioTipo: (t: "lista" | "efectivo") => void;
  onSoporta: (v: boolean) => void;
  onRemove: () => void;
  removable: boolean;
}) {
  const servicio = servicios.find((s) => s.id === linea.servicio_id);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 items-start">
        <div className="col-span-12 sm:col-span-2 flex items-center">
          <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded bg-sage-100 text-sage-800 ring-1 ring-inset ring-sage-700/30">
            <Scissors className="h-3.5 w-3.5 stroke-[1.5]" />
            Servicio
          </span>
        </div>
        <div className="col-span-12 sm:col-span-3">
          <select
            value={linea.servicio_id}
            onChange={(e) => onServicio(e.target.value)}
            className="w-full px-2 py-1.5 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— Servicio —</option>
            {servicios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-12 sm:col-span-3">
          <select
            value={linea.empleado_id}
            onChange={(e) => onEmpleado(e.target.value)}
            className="w-full px-2 py-1.5 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— Empleado —</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-6 sm:col-span-2">
          <CurrencyInput
            value={linea.precio}
            onChange={onPrecio}
            min={0}
            className="w-full px-2 py-1.5 text-right tabular-nums border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="col-span-5 sm:col-span-1 text-right tabular-nums text-sm self-center">
          <span
            style={{
              color: comision > 0 ? "var(--sage-700)" : "var(--muted-foreground)",
              fontWeight: comision > 0 ? 500 : 400,
            }}
          >
            {formatARS(comision)}
          </span>
          {linea.servicio_id && (
            <p className="text-[10px] text-muted-foreground">
              {linea.comision_pct || 0}%
            </p>
          )}
        </div>
        <div className="col-span-1 self-center text-center">
          <button
            type="button"
            onClick={onRemove}
            disabled={!removable}
            className="text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
            title="Quitar línea"
          >
            <X className="h-4 w-4 stroke-[1.5]" />
          </button>
        </div>
      </div>

      {/* Controles de precio y comisión por descuento */}
      {linea.servicio_id && (
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-12 sm:col-start-3 sm:col-span-4 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
              Precio
            </span>
            <div className="inline-flex rounded-md border border-border overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => onPrecioTipo("lista")}
                className={`px-2.5 py-1 transition-colors ${
                  linea.precio_tipo === "lista"
                    ? "bg-sage-700 text-white"
                    : "bg-card hover:bg-cream"
                }`}
              >
                Lista
                {servicio ? ` · ${formatARS(servicio.precio_lista)}` : ""}
              </button>
              <button
                type="button"
                onClick={() => onPrecioTipo("efectivo")}
                className={`px-2.5 py-1 border-l border-border transition-colors ${
                  linea.precio_tipo === "efectivo"
                    ? "bg-sage-700 text-white"
                    : "bg-card hover:bg-cream"
                }`}
              >
                Efectivo
                {servicio ? ` · ${formatARS(servicio.precio_efectivo)}` : ""}
              </button>
            </div>
          </div>
          <div className="col-span-12 sm:col-span-5 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
              ¿Empleada absorbe el descuento?
            </span>
            <div className="inline-flex rounded-md border border-border overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => onSoporta(true)}
                title="Comisión sobre el precio final pagado"
                className={`px-2.5 py-1 transition-colors ${
                  linea.soporta_descuento
                    ? "bg-sage-700 text-white"
                    : "bg-card hover:bg-cream"
                }`}
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => onSoporta(false)}
                title="Comisión sobre el precio de lista (regular)"
                className={`px-2.5 py-1 border-l border-border transition-colors ${
                  !linea.soporta_descuento
                    ? "bg-sage-700 text-white"
                    : "bg-card hover:bg-cream"
                }`}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BancoSelector({
  cuentas,
  value,
  onChange,
  label,
}: {
  cuentas: CuentaBancaria[];
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {cuentas.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No hay cuentas bancarias cargadas. Cargá Macro / Galicia en Catálogos →
          Cuentas bancarias.
        </p>
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">— Cuenta por defecto del medio —</option>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function LineaProductoRow({
  linea,
  productos,
  onProducto,
  onCantidad,
  onPrecio,
  onRemove,
  removable,
}: {
  linea: LineaProductoForm;
  productos: Insumo[];
  onProducto: (id: string) => void;
  onCantidad: (v: number) => void;
  onPrecio: (v: number) => void;
  onRemove: () => void;
  removable: boolean;
}) {
  const subtotal = subtotalLinea(linea);
  return (
    <div className="grid grid-cols-12 gap-2 items-start">
      <div className="col-span-12 sm:col-span-2 flex items-center">
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-500/40">
          <Package className="h-3.5 w-3.5 stroke-[1.5]" />
          Producto
        </span>
      </div>
      <div className="col-span-12 sm:col-span-4">
        <select
          value={linea.insumo_id}
          onChange={(e) => onProducto(e.target.value)}
          className="w-full px-2 py-1.5 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">— Producto —</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
              {p.precio_venta != null ? ` · ${formatARS(p.precio_venta)}` : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="col-span-4 sm:col-span-2">
        <input
          type="number"
          step="1"
          min="1"
          value={linea.cantidad}
          onChange={(e) => onCantidad(Number(e.target.value))}
          className="w-full px-2 py-1.5 text-right tabular-nums border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="text-[10px] text-muted-foreground text-right mt-0.5">
          Cantidad
        </p>
      </div>
      <div className="col-span-7 sm:col-span-2">
        <CurrencyInput
          value={linea.precio}
          onChange={onPrecio}
          min={0}
          className="w-full px-2 py-1.5 text-right tabular-nums border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="text-[10px] text-muted-foreground text-right mt-0.5">
          Precio unitario
        </p>
      </div>
      <div className="col-span-12 sm:col-span-1 text-right tabular-nums text-sm self-center">
        <span className="font-medium">{formatARS(subtotal)}</span>
        <p className="text-[10px] text-muted-foreground">Subtotal</p>
      </div>
      <div className="col-span-12 sm:col-span-1 self-center text-center">
        <button
          type="button"
          onClick={onRemove}
          disabled={!removable}
          className="text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
          title="Quitar línea"
        >
          <X className="h-4 w-4 stroke-[1.5]" />
        </button>
      </div>
    </div>
  );
}
