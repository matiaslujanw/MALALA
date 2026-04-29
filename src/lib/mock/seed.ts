/**
 * Datos seed para desarrollo. Cantidades chicas pero realistas.
 */
import type { Store } from "./store";

const uid = () => crypto.randomUUID();

export function seed(): Store {
  // Sucursales
  const sucYB = { id: uid(), nombre: "Yerba Buena", activo: true };
  const sucBN = { id: uid(), nombre: "Barrio Norte", activo: true };

  // Usuarios (auth stub: el id se usa como sesión)
  const userAdmin = {
    id: uid(),
    email: "admin@malala.com",
    nombre: "Admin",
    rol: "admin" as const,
    sucursal_default_id: sucYB.id,
    activo: true,
  };
  const userEncargadaYB = {
    id: uid(),
    email: "encargada.yb@malala.com",
    nombre: "Carolina (Encargada YB)",
    rol: "encargada" as const,
    sucursal_default_id: sucYB.id,
    activo: true,
  };
  const userEmpleadoYB = {
    id: uid(),
    email: "anita@malala.com",
    nombre: "Anita Juarez",
    rol: "empleado" as const,
    sucursal_default_id: sucYB.id,
    activo: true,
  };

  // Medios de pago
  const mpEF = { id: uid(), codigo: "EF", nombre: "Efectivo", activo: true };
  const mpTR = { id: uid(), codigo: "TR", nombre: "Transferencia", activo: true };
  const mpTC = { id: uid(), codigo: "TC", nombre: "Tarjeta crédito", activo: true };
  const mpTD = { id: uid(), codigo: "TD", nombre: "Tarjeta débito", activo: true };
  const mpMP = { id: uid(), codigo: "MP", nombre: "Mercado Pago", activo: true };

  // Rubros de gasto
  const rgInsumos = { id: uid(), rubro: "Insumos", subrubro: "Compra", activo: true };
  const rgServicios = { id: uid(), rubro: "Servicios", subrubro: "Luz/Agua", activo: true };
  const rgSueldos = { id: uid(), rubro: "Sueldos", activo: true };
  const rgVarios = { id: uid(), rubro: "Varios", activo: true };

  // Proveedores
  const provVlinda = { id: uid(), nombre: "VLinda", telefono: "+5493815551001", deuda_pendiente: 0 };
  const provKeraplus = { id: uid(), nombre: "Keraplus", telefono: "+5493815551002", deuda_pendiente: 0 };
  const provDistrilook = { id: uid(), nombre: "Distrilook", deuda_pendiente: 0 };

  // Empleados
  const empAnita = {
    id: uid(),
    nombre: "Anita Juarez",
    activo: true,
    sucursal_principal_id: sucYB.id,
    tipo_comision: "mixto" as const,
    porcentaje_default: 30,
    sueldo_asegurado: 800000,
    observacion: "Peluquera",
  };
  const empCamila = {
    id: uid(),
    nombre: "Camila Moreno",
    activo: true,
    sucursal_principal_id: sucYB.id,
    tipo_comision: "porcentaje" as const,
    porcentaje_default: 30,
    sueldo_asegurado: 500000,
    observacion: "Manicurista",
  };
  const empEliana = {
    id: uid(),
    nombre: "Eliana Monroy",
    activo: true,
    sucursal_principal_id: sucBN.id,
    tipo_comision: "porcentaje" as const,
    porcentaje_default: 30,
    sueldo_asegurado: 500000,
    observacion: "Manicurista",
  };
  const empCarolina = {
    id: uid(),
    nombre: "Carolina Rodriguez",
    activo: true,
    sucursal_principal_id: sucYB.id,
    tipo_comision: "sueldo_fijo" as const,
    porcentaje_default: 10,
    sueldo_asegurado: 1150000,
    observacion: "Encargada",
  };

  // Vinculo el usuario "empleado" con su registro Empleado para
  // que la UI pueda filtrar a su propia data.
  (userEmpleadoYB as { empleado_id?: string }).empleado_id = empAnita.id;

  // Clientes
  const cliMaria = { id: uid(), nombre: "María Pérez", telefono: "+5493815552001", activo: true, saldo_cc: 0 };
  const cliLucia = { id: uid(), nombre: "Lucía Gómez", telefono: "+5493815552002", activo: true, saldo_cc: 0 };
  const cliSofia = { id: uid(), nombre: "Sofía López", telefono: "+5493815552003", activo: true, saldo_cc: 0 };
  const cliConsumidor = { id: uid(), nombre: "Consumidor Final", activo: true, saldo_cc: 0 };

  // Servicios
  const servCorteMujer = {
    id: uid(),
    rubro: "SERVICIOS DE PELUQUERIA",
    nombre: "Corte mujer",
    precio_lista: 25000,
    precio_efectivo: 22000,
    comision_default_pct: 30,
    activo: true,
  };
  const servBrushing = {
    id: uid(),
    rubro: "SERVICIOS DE PELUQUERIA",
    nombre: "Brushing",
    precio_lista: 18000,
    precio_efectivo: 16000,
    comision_default_pct: 30,
    activo: true,
  };
  const servColorRaiz = {
    id: uid(),
    rubro: "SERVICIOS DE PELUQUERIA",
    nombre: "Color raíz",
    precio_lista: 45000,
    precio_efectivo: 40000,
    comision_default_pct: 30,
    activo: true,
  };
  const servManosEsmaltado = {
    id: uid(),
    rubro: "SERVICIOS NAILS",
    nombre: "Manos esmaltado tradicional",
    precio_lista: 12000,
    precio_efectivo: 10000,
    comision_default_pct: 30,
    activo: true,
  };
  const servManosSemi = {
    id: uid(),
    rubro: "SERVICIOS NAILS",
    nombre: "Manos semipermanente",
    precio_lista: 18000,
    precio_efectivo: 15000,
    comision_default_pct: 30,
    activo: true,
  };
  const servPiesSemi = {
    id: uid(),
    rubro: "SERVICIOS NAILS",
    nombre: "Pies semipermanente",
    precio_lista: 20000,
    precio_efectivo: 17000,
    comision_default_pct: 30,
    activo: true,
  };
  const servCejas = {
    id: uid(),
    rubro: "CEJAS & PESTAÑAS",
    nombre: "Diseño de cejas",
    precio_lista: 10000,
    precio_efectivo: 8000,
    comision_default_pct: 30,
    activo: true,
  };
  const servFacial = {
    id: uid(),
    rubro: "FACIAL",
    nombre: "Limpieza facial básica",
    precio_lista: 30000,
    precio_efectivo: 26000,
    comision_default_pct: 30,
    activo: true,
  };

  // Insumos
  const insShampoo = {
    id: uid(),
    nombre: "Shampoo neutro 1L",
    proveedor_id: provVlinda.id,
    unidad_medida: "ml" as const,
    tamano_envase: 1000,
    precio_envase: 8000,
    precio_unitario: 8,
    umbral_stock_bajo: 500,
    activo: true,
  };
  const insTinturaCastano = {
    id: uid(),
    nombre: "Tintura castaño 60g",
    proveedor_id: provKeraplus.id,
    unidad_medida: "g" as const,
    tamano_envase: 60,
    precio_envase: 4500,
    precio_unitario: 75,
    umbral_stock_bajo: 240,
    activo: true,
  };
  const insOxidante20 = {
    id: uid(),
    nombre: "Oxidante 20vol 1L",
    proveedor_id: provKeraplus.id,
    unidad_medida: "ml" as const,
    tamano_envase: 1000,
    precio_envase: 6000,
    precio_unitario: 6,
    umbral_stock_bajo: 1000,
    activo: true,
  };
  const insEsmalteSemi = {
    id: uid(),
    nombre: "Esmalte semipermanente 15ml",
    proveedor_id: provDistrilook.id,
    unidad_medida: "ml" as const,
    tamano_envase: 15,
    precio_envase: 3500,
    precio_unitario: 233.33,
    umbral_stock_bajo: 60,
    activo: true,
  };
  const insAlgodonDisco = {
    id: uid(),
    nombre: "Disco algodón",
    proveedor_id: provVlinda.id,
    unidad_medida: "ud" as const,
    tamano_envase: 100,
    precio_envase: 1500,
    precio_unitario: 15,
    umbral_stock_bajo: 200,
    activo: true,
  };
  const insAcetona = {
    id: uid(),
    nombre: "Acetona 500ml",
    proveedor_id: provVlinda.id,
    unidad_medida: "ml" as const,
    tamano_envase: 500,
    precio_envase: 2500,
    precio_unitario: 5,
    umbral_stock_bajo: 500,
    activo: true,
  };
  const insMascarillaFacial = {
    id: uid(),
    nombre: "Mascarilla facial unidosis",
    proveedor_id: provDistrilook.id,
    unidad_medida: "aplicacion" as const,
    tamano_envase: 1,
    precio_envase: 1200,
    precio_unitario: 1200,
    umbral_stock_bajo: 10,
    activo: true,
  };

  // Recetas (servicio → insumo, cantidad)
  const recetas = [
    { id: uid(), servicio_id: servCorteMujer.id, insumo_id: insShampoo.id, cantidad: 30 },
    { id: uid(), servicio_id: servBrushing.id, insumo_id: insShampoo.id, cantidad: 20 },
    { id: uid(), servicio_id: servColorRaiz.id, insumo_id: insTinturaCastano.id, cantidad: 30 },
    { id: uid(), servicio_id: servColorRaiz.id, insumo_id: insOxidante20.id, cantidad: 60 },
    { id: uid(), servicio_id: servColorRaiz.id, insumo_id: insAlgodonDisco.id, cantidad: 4 },
    { id: uid(), servicio_id: servManosSemi.id, insumo_id: insEsmalteSemi.id, cantidad: 2 },
    { id: uid(), servicio_id: servManosSemi.id, insumo_id: insAcetona.id, cantidad: 5 },
    { id: uid(), servicio_id: servPiesSemi.id, insumo_id: insEsmalteSemi.id, cantidad: 2 },
    { id: uid(), servicio_id: servManosEsmaltado.id, insumo_id: insAcetona.id, cantidad: 3 },
    { id: uid(), servicio_id: servFacial.id, insumo_id: insMascarillaFacial.id, cantidad: 1 },
  ];

  // Stock inicial: stock razonable en YB, mitad en BN
  const insumos = [
    insShampoo, insTinturaCastano, insOxidante20, insEsmalteSemi,
    insAlgodonDisco, insAcetona, insMascarillaFacial,
  ];
  const stockSucursal = insumos.flatMap((i) => [
    { id: uid(), insumo_id: i.id, sucursal_id: sucYB.id, cantidad: i.umbral_stock_bajo * 3 },
    { id: uid(), insumo_id: i.id, sucursal_id: sucBN.id, cantidad: i.umbral_stock_bajo * 1.5 },
  ]);

  // Ventas / ingresos de muestra (5 tickets recientes)
  const ingresos: ReturnType<typeof seed>["ingresos"] = [];
  const ingresoLineas: ReturnType<typeof seed>["ingresoLineas"] = [];

  function fechaHaceDias(dias: number, hora = 14): string {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    d.setHours(hora, 0, 0, 0);
    return d.toISOString();
  }

  function crearTicket(args: {
    fecha: string;
    sucursalId: string;
    clienteId?: string;
    lineas: Array<{
      servicioId: string;
      empleadoId: string;
      precio: number;
      comisionPct?: number;
    }>;
    mp1Id: string;
    valor1?: number;
    mp2Id?: string;
    valor2?: number;
    descuentoPct?: number;
    observacion?: string;
  }) {
    const ingresoId = uid();
    const subtotal = args.lineas.reduce((acc, l) => acc + l.precio, 0);
    const descuentoPct = args.descuentoPct ?? 0;
    const descuentoMonto = subtotal * (descuentoPct / 100);
    const total = subtotal - descuentoMonto;

    ingresos.push({
      id: ingresoId,
      fecha: args.fecha,
      sucursal_id: args.sucursalId,
      cliente_id: args.clienteId,
      subtotal,
      descuento_pct: descuentoPct,
      descuento_monto: descuentoMonto,
      total,
      mp1_id: args.mp1Id,
      valor1: args.valor1 ?? total,
      mp2_id: args.mp2Id,
      valor2: args.valor2,
      observacion: args.observacion,
      usuario_id: userEncargadaYB.id,
      anulado: false,
    });

    for (const l of args.lineas) {
      const pct = l.comisionPct ?? 30;
      ingresoLineas.push({
        id: uid(),
        ingreso_id: ingresoId,
        servicio_id: l.servicioId,
        empleado_id: l.empleadoId,
        precio_efectivo: l.precio,
        cantidad: 1,
        subtotal: l.precio,
        comision_pct: pct,
        comision_monto: l.precio * (pct / 100),
      });
    }
  }

  // Ticket 1: hoy YB — María, 2 servicios con Anita
  crearTicket({
    fecha: fechaHaceDias(0, 11),
    sucursalId: sucYB.id,
    clienteId: cliMaria.id,
    lineas: [
      { servicioId: servColorRaiz.id, empleadoId: empAnita.id, precio: 40000 },
      { servicioId: servBrushing.id, empleadoId: empAnita.id, precio: 16000 },
    ],
    mp1Id: mpEF.id,
  });

  // Ticket 2: hoy YB — Lucía, manicura + pedicura con Camila
  crearTicket({
    fecha: fechaHaceDias(0, 13),
    sucursalId: sucYB.id,
    clienteId: cliLucia.id,
    lineas: [
      { servicioId: servManosSemi.id, empleadoId: empCamila.id, precio: 15000 },
      { servicioId: servPiesSemi.id, empleadoId: empCamila.id, precio: 17000 },
    ],
    mp1Id: mpTC.id,
    valor1: 32000,
  });

  // Ticket 3: hoy YB — Sofía, corte con Anita + manicura con Camila (2 empleados)
  crearTicket({
    fecha: fechaHaceDias(0, 16),
    sucursalId: sucYB.id,
    clienteId: cliSofia.id,
    lineas: [
      { servicioId: servCorteMujer.id, empleadoId: empAnita.id, precio: 22000 },
      {
        servicioId: servManosEsmaltado.id,
        empleadoId: empCamila.id,
        precio: 10000,
      },
    ],
    mp1Id: mpEF.id,
    valor1: 20000,
    mp2Id: mpTR.id,
    valor2: 12000,
  });

  // Ticket 4: hoy BN — María, manicura con Eliana
  crearTicket({
    fecha: fechaHaceDias(0, 15),
    sucursalId: sucBN.id,
    clienteId: cliMaria.id,
    lineas: [
      {
        servicioId: servManosSemi.id,
        empleadoId: empEliana.id,
        precio: 15000,
      },
    ],
    mp1Id: mpEF.id,
  });

  // Ticket 5: ayer YB — Consumidor Final, cejas con Anita
  crearTicket({
    fecha: fechaHaceDias(1, 17),
    sucursalId: sucYB.id,
    clienteId: cliConsumidor.id,
    lineas: [
      { servicioId: servCejas.id, empleadoId: empAnita.id, precio: 8000 },
    ],
    mp1Id: mpEF.id,
  });

  // Ticket 6: hace 3 días YB — Lucía, ticket grande con descuento
  crearTicket({
    fecha: fechaHaceDias(3, 12),
    sucursalId: sucYB.id,
    clienteId: cliLucia.id,
    lineas: [
      { servicioId: servCorteMujer.id, empleadoId: empAnita.id, precio: 22000 },
      { servicioId: servColorRaiz.id, empleadoId: empAnita.id, precio: 40000 },
    ],
    mp1Id: mpTC.id,
    descuentoPct: 10,
    observacion: "Cliente frecuente",
  });

  return {
    sucursales: [sucYB, sucBN],
    usuarios: [userAdmin, userEncargadaYB, userEmpleadoYB],
    empleados: [empAnita, empCamila, empEliana, empCarolina],
    clientes: [cliMaria, cliLucia, cliSofia, cliConsumidor],
    proveedores: [provVlinda, provKeraplus, provDistrilook],
    servicios: [
      servCorteMujer, servBrushing, servColorRaiz,
      servManosEsmaltado, servManosSemi, servPiesSemi,
      servCejas, servFacial,
    ],
    insumos,
    recetas,
    mediosPago: [mpEF, mpTR, mpTC, mpTD, mpMP],
    rubrosGasto: [rgInsumos, rgServicios, rgSueldos, rgVarios],
    stockSucursal,
    movimientosStock: [],
    ingresos,
    ingresoLineas,
    egresos: [],
    cierresCaja: [],
  };
}
