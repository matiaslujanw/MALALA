"use client";

import { useState } from "react";
import Link from "next/link";
import type { ComponentType } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  HandCoins,
  Landmark,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Package,
  Receipt,
  ShoppingBag,
  Wallet,
  X,
} from "lucide-react";

interface SidebarProps {
  navItems: { href: string; label: string; iconKey: string; group?: string }[];
}

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  ShoppingBag,
  CalendarDays,
  Wallet,
  Landmark,
  HandCoins,
  Package,
  Receipt,
  BookOpen,
  BarChart3,
  MessageCircle,
};

export function AppSidebar({ navItems }: SidebarProps) {
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
          className="block px-6 py-4 border-b border-border hover:bg-cream/40 transition-colors"
        >
          <h1 className="font-display text-xl tracking-[0.3em] uppercase">
            MALALA
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
            Hair and Nails
          </p>
        </Link>

        <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-0.5">
          {navItems.map((item, i) => {
            const Icon = ICONS[item.iconKey] ?? LayoutDashboard;
            const showHeader =
              !!item.group && item.group !== navItems[i - 1]?.group;
            return (
              <div key={item.href}>
                {showHeader && (
                  <p
                    className={`px-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground ${
                      i === 0 ? "pb-1.5" : "pt-4 pb-1.5"
                    }`}
                  >
                    {item.group}
                  </p>
                )}
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-cream transition-colors"
                >
                  <Icon className="h-4 w-4 stroke-[1.5]" />
                  <span>{item.label}</span>
                </Link>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
