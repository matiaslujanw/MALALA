# MALALA — Brand Tokens

> Sistema de diseño para el sistema de gestión de MALALA Hair and Nails. Estos tokens se aplican en `globals.css`, `tailwind.config.ts` y los componentes shadcn/ui.

---

## 1. Identidad visual

**Estilo:** minimalista, fashion, tipográfico. Inspirado en el logo: alto contraste, mucho espaciado entre letras, sensación de salón premium con guiño botánico/wellness.

**Reglas duras:**
- La tipografía display (logo) **nunca** se usa para body, tablas o formularios. Solo títulos cortos.
- El verde botánico es **acento**, no protagonista. Usarlo para estados, links, focus, badges, gráficos. Nunca de fondo principal.
- Mantener jerarquía clara: texto negro sobre fondo blanco. Grises solo para info secundaria.

---

## 2. Tipografías

Como Engravers Gothic y Bantayog son comerciales, usamos alternativas Google Fonts gratuitas que mantienen la estética:

| Rol en el sistema | Fuente original | Reemplazo Google Fonts | Uso |
|---|---|---|---|
| Display / Logo / Headers grandes | Engravers Gothic Regular | **Cinzel** (regular 400) | Logo en sidebar, títulos de página tipo "VENTAS", "STOCK" |
| UI / Body / Forms / Tablas | Bantayog | **Montserrat** (300, 400, 500, 600, 700) | Todo el resto |

**Importación en `app/layout.tsx`:**

```tsx
import { Cinzel, Montserrat } from "next/font/google";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-display",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
});

// En el <html>: className={`${cinzel.variable} ${montserrat.variable}`}
```

**Configuración en `tailwind.config.ts`:**

```ts
fontFamily: {
  sans: ["var(--font-sans)", "system-ui", "sans-serif"],
  display: ["var(--font-display)", "serif"],
}
```

**Jerarquía tipográfica:**

| Elemento | Clase | Detalle |
|---|---|---|
| Logo MALALA | `font-display text-2xl tracking-[0.3em]` | Espaciado amplio, mayúsculas |
| H1 página | `font-display text-3xl tracking-[0.2em] uppercase` | "VENTAS", "STOCK" |
| H2 sección | `font-sans text-xl font-medium tracking-wide` | "Movimientos del día" |
| H3 sub | `font-sans text-base font-semibold` | Cards, paneles |
| Body | `font-sans text-sm font-normal` | Default |
| Labels form | `font-sans text-xs font-medium uppercase tracking-wider` | Inputs |
| Tablas | `font-sans text-sm font-normal tabular-nums` | Números alineados |
| Botones | `font-sans text-sm font-medium tracking-wide uppercase` | Primarios |

---

## 3. Paleta de colores

Base blanco/negro del logo + verdes botánicos como acento (sage, eucalyptus). Pensado para un dashboard que se mira muchas horas: alto contraste pero sin estridencias.

### Colores raw

```css
/* Neutros (base) */
--white:           #FFFFFF;
--off-white:       #FAFAF9;   /* fondo principal */
--cream:           #F5F4F0;   /* fondos sutiles, hover */
--stone-100:       #E7E5E0;   /* bordes claros */
--stone-300:       #C4C2BC;   /* bordes default */
--stone-500:       #78766F;   /* texto secundario */
--stone-700:       #3F3D38;   /* texto cuerpo */
--ink:             #1A1A1A;   /* texto principal, casi negro */
--black:           #000000;   /* logo, énfasis máximo */

/* Verdes botánicos (acento) */
--sage-50:         #F2F5F0;   /* fondos sutiles de éxito/info */
--sage-100:        #DDE5D6;   /* badges suaves */
--sage-300:        #A8B89A;
--sage-500:        #6E8060;   /* acento principal — botones, links, focus */
--sage-700:        #4A5840;   /* hover de acento */
--sage-900:        #2C3525;   /* texto sobre fondos sage claros */

/* Semánticos */
--success:         #6E8060;   /* = sage-500, coherente */
--warning:         #C9A961;   /* dorado tenue, no chillón */
--danger:          #A84A3D;   /* rojo terracota, no rojo puro */
--info:            #6E8060;   /* mismo verde, no azul */
```

### Tokens shadcn/ui (en `globals.css`)

```css
@layer base {
  :root {
    --background: 36 17% 98%;          /* off-white */
    --foreground: 0 0% 10%;            /* ink */

    --card: 0 0% 100%;
    --card-foreground: 0 0% 10%;

    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 10%;

    --primary: 92 14% 44%;             /* sage-500 */
    --primary-foreground: 0 0% 100%;

    --secondary: 40 15% 95%;           /* cream */
    --secondary-foreground: 0 0% 10%;

    --muted: 40 15% 95%;
    --muted-foreground: 36 4% 46%;     /* stone-500 */

    --accent: 92 14% 44%;              /* sage-500 */
    --accent-foreground: 0 0% 100%;

    --destructive: 9 47% 45%;          /* terracota */
    --destructive-foreground: 0 0% 100%;

    --border: 40 8% 88%;               /* stone-100 */
    --input: 40 8% 88%;
    --ring: 92 14% 44%;                /* sage-500 para focus */

    --radius: 0.375rem;                /* 6px — sobrio, no muy redondeado */
  }

  /* Modo oscuro: opcional, no priorizar en Fase 1.
     Si lo activan después: invertir base manteniendo sage como acento. */
}
```

### Reglas de uso por contexto

| Contexto | Color | Notas |
|---|---|---|
| Fondo de página | `bg-background` (off-white) | Nunca blanco puro, da más calidez |
| Cards / paneles | `bg-card` (white) | Contraste sutil con el fondo |
| Texto principal | `text-foreground` (ink) | |
| Texto secundario | `text-muted-foreground` | Fechas, hints, descripciones |
| Botón primario | `bg-primary text-primary-foreground` | Sage. Acciones de guardar, confirmar |
| Botón ghost | `variant="ghost"` | Acciones secundarias, navegación |
| Botón destructivo | `variant="destructive"` | Eliminar, anular venta |
| Stock OK | `bg-sage-100 text-sage-900` | Badge |
| Stock bajo | `bg-warning/10 text-warning` | Dorado tenue |
| Stock negativo | `bg-destructive/10 text-destructive` | Terracota |
| Cerrado / inactivo | `bg-stone-100 text-stone-500` | Caja cerrada, cliente inactivo |

---

## 4. Espaciados y radios

Estética generosa, no apretada (acompaña la sensación premium del logo).

| Token | Uso |
|---|---|
| `gap-6` | Default entre cards en grids |
| `p-6` | Padding interno de cards |
| `space-y-8` | Entre secciones grandes de una página |
| `tracking-wider` / `tracking-widest` | Para reforzar la estética del logo en headers |
| `rounded-md` (6px) | Default. Sobrio. Evitar `rounded-xl` o más. |

---

## 5. Iconografía

**Librería:** `lucide-react` (ya viene con shadcn).

**Reglas:**
- Stroke 1.5 (más fino que el default 2, queda más elegante)
- Tamaño base 16px en UI, 20px en headers, 14px en badges
- Color: heredan del texto (`text-current`), nunca color propio salvo estados semánticos

```tsx
<Icon className="h-4 w-4 stroke-[1.5]" />
```

---

## 6. Logo

Archivo: `/public/brand/logo.png` (usar el PNG provisto por la marca).

**Versiones a crear:**
- `logo.png` → original, fondo blanco
- `logo-mark.svg` → solo "MALALA" sin tagline, para favicon y sidebar colapsado
- `favicon.ico` → 32x32

**Reglas de uso en la app:**
- Sidebar expandido: logo completo, max-height 48px
- Sidebar colapsado: solo "M" en font-display
- Login: logo grande centrado, max-width 280px
- Email/PDF reports: logo en header con padding generoso

**No usar** el logo sobre fondos sage o oscuros sin una versión adaptada (queda mal el negro sobre verde).

---

## 7. Aplicación práctica — ejemplos

**Header de página:**
```tsx
<div className="space-y-1 mb-8">
  <h1 className="font-display text-3xl tracking-[0.2em] uppercase">Ventas</h1>
  <p className="text-sm text-muted-foreground">Gestión de ingresos y comisiones</p>
</div>
```

**Card de KPI:**
```tsx
<Card className="p-6">
  <p className="text-xs uppercase tracking-wider text-muted-foreground">Ventas del día</p>
  <p className="font-display text-3xl mt-2">$ 1.245.000</p>
  <p className="text-xs text-sage-700 mt-1">+12% vs ayer</p>
</Card>
```

**Botón primario:**
```tsx
<Button className="tracking-wider uppercase">Guardar venta</Button>
```

---

## 8. Qué evitar

- Gradientes, sombras pronunciadas, glassmorphism — chocan con la estética minimalista del logo
- Colores saturados (rosas chicle, dorados brillantes, azules vivos) — no pertenecen al universo de marca
- Bordes redondeados grandes (`rounded-xl`, `rounded-2xl`)
- Iconos de stroke grueso o con relleno
- Mezclar más de 2 fuentes en una misma vista
- Usar Cinzel (display) para textos largos o números — es ilegible en cuerpo
