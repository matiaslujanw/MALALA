"use client";

import { useState } from "react";
import Link from "next/link";
import type { ComponentType } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Receipt,
  ShoppingBag,
  Wallet,
  X,
} from "lucide-react";
import { logout } from "@/lib/auth/actions";
import type { Rol } from "@/lib/types";

const ROL_LABEL: Record<string, string> = {
  admin: "Admin",
  encargada: "Encargada",
  empleado: "Empleado",
};

interface SidebarProps {
  userName: string;
  userRol: Rol;
  navItems: { href: string; label: string; iconKey: string }[];
}

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  ShoppingBag,
  CalendarDays,
  Wallet,
  Package,
  Receipt,
  BookOpen,
  BarChart3,
};

export function AppSidebar({ userName, userRol, navItems }: SidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed top-3 left-3 z-50 lg:hidden rounded-xl bg-card border border-border p-2 text-muted-foreground shadow-sm hover:bg-cream transition"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-screen w-64 shrink-0 border-r border-border bg-card flex flex-col
          transition-transform duration-200 ease-out
          lg:sticky lg:top-0 lg:translate-x-0 lg:self-start
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute top-3 right-3 lg:hidden rounded-full p-1.5 text-muted-foreground hover:bg-stone-100 transition"
          aria-label="Cerrar menú"
        >
          <X className="h-4 w-4" />
        </button>

        <Link
          href="/dashboard"
          onClick={() => setOpen(false)}
          className="block p-6 border-b border-border hover:bg-cream/40 transition-colors"
        >
          <h1 className="font-display text-xl tracking-[0.3em] uppercase">
            MALALA
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
            Hair and Nails
          </p>
        </Link>

        <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-0.5">
          {navItems.map((item) => {
            const Icon = ICONS[item.iconKey] ?? LayoutDashboard;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-cream transition-colors"
              >
                <Icon className="h-4 w-4 stroke-[1.5]" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border space-y-2">
          <div className="px-3 py-2">
            <p className="text-sm font-medium truncate">{userName}</p>
            <p className="text-xs text-muted-foreground">{ROL_LABEL[userRol]}</p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-cream hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4 stroke-[1.5]" />
              <span>Salir</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
