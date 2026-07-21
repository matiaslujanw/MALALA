# MALALA — Brand Tokens

> Sistema de diseño de MALALA Hair and Nails, común a la landing pública y a la app interna. Los tokens viven **solo** en `src/app/globals.css` (Tailwind v4, bloque `@theme inline`): no hay `tailwind.config.ts`.

---

## 1. Identidad visual

**Estilo:** minimalista, fashion, tipográfico. Inspirado en el logo: alto contraste, mucho espaciado entre letras, sensación de salón premium con guiño botánico/wellness.

**Reglas duras:**
- La tipografía display (logo) **nunca** se usa para body, tablas o formularios. Solo títulos cortos.
- El verde botánico es **acento**, no protagonista. Usarlo para estados, links, focus, badges, gráficos. Nunca de fondo principal.
- Mantener jerarquía clara: texto negro sobre fondo blanco. Grises solo para info secundaria.

---

## 2. Tipografías

El brief de marca pide **Gotham → Lato → Helvetica**. Gotham es comercial (Hoefler&Co) y no se distribuye acá, así que servimos Lato desde Google Fonts; el stack la deja primero para que, si algún día se licencia y se instala, gane sin tocar código.

| Rol | Fuente | Uso |
|---|---|---|
| UI / Body / Forms / Tablas | **Lato** (300, 400, 700, 900) | Todo el texto corriente, landing y app interna |
| Display / Logo / Headers grandes | **Cinzel** (400, 500) | Logo, "EXPERIENCIA MALALA", títulos tipo "VENTAS", "STOCK" |
| Script editorial | **Pinyon Script** (400) | Solo landing: título "Servicios" y placeholders de foto |

**Importación en `src/app/layout.tsx`:** `next/font/google` expone `--font-lato`, `--font-display` y `--font-script`, y las tres variables se aplican en el `<html>`.

**Stack en `globals.css` (`@theme inline`):**

```css
--font-sans: Gotham, var(--font-lato), "Helvetica Neue", Helvetica, Arial, sans-serif;
--font-display: var(--font-display), serif;
--font-script: var(--font-script), cursive;
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

Tres colores de marca — **marrón `#5D4B3D`, verde `#495A47`, claro `#E0DFDC`** — sobre una base de neutros cálidos. Pensado para un dashboard que se mira muchas horas: alto contraste pero sin estridencias.

> Nota de nomenclatura: la escala verde sigue llamándose `sage-*` porque la usan ~79 archivos de la app interna. Los **nombres** se conservan, los **valores** son los de marca.

### Colores raw (`:root` en `globals.css`)

```css
/* Neutros (base) */
--white:           #FFFFFF;
--off-white:       #F7F6F4;   /* fondo principal de la app */
--cream:           #EEEDEA;   /* fondos sutiles, hover */
--sand:            #E0DFDC;   /* "clarito" de marca — fondo de secciones de landing */
--stone-100:       #D8D6D2;   /* bordes claros */
--stone-300:       #B4B2AD;   /* bordes default */
--stone-500:       #78766F;   /* texto secundario */
--stone-700:       #3F3D38;   /* texto cuerpo */
--ink:             #1A1A1A;   /* texto principal, bandas negras */
--black:           #000000;

/* Verde de marca (escala "sage") */
--sage-50:         #F1F4F0;
--sage-100:        #DCE3DA;
--sage-200:        #C3CDC0;
--sage-300:        #9AA898;
--sage-500:        #495A47;   /* verde de marca — botones, links, focus */
--sage-700:        #3A4739;   /* hover de acento */
--sage-800:        #2C362B;
--sage-900:        #1F271E;

/* Marrón de marca */
--brown-50:        #F5F2EF;
--brown-100:       #E6DFD8;
--brown-300:       #A89485;
--brown-500:       #5D4B3D;   /* marrón de marca — velo del hero, banda de promos */
--brown-700:       #453729;
--brown-900:       #2B221A;

/* Semánticos */
--success:         #495A47;   /* = sage-500, coherente */
--warning:         #C9A961;   /* dorado tenue, no chillón */
--danger:          #A84A3D;   /* rojo terracota, no rojo puro */
--info:            #495A47;   /* mismo verde, no azul */
```

Los tokens shadcn (`--background`, `--primary`, `--border`, …) son alias de los de arriba y están definidos más abajo en el mismo `:root`; `@theme inline` los expone como utilidades (`bg-primary`, `text-sage-700`, `bg-brown-500`, `bg-sand`). No hay modo oscuro.

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
| Bandas de landing | `bg-ink` / `bg-sand` / `bg-brown-500` | Negro para títulos de sección, claro para separadores, marrón para promos e Instagram |

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
- Mezclar más de 2 fuentes en una misma vista de la app interna (la landing usa 3: Lato + Cinzel + un toque de Pinyon Script)
- Usar Cinzel (display) para textos largos o números — es ilegible en cuerpo
