"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { TableActionLink } from "@/components/table-action-link";
import { formatARS } from "@/lib/utils";

export interface CierreResumenRow {
  id: string;
  fecha: string; // YYYY-MM-DD
  cerradoPor: string;
  totalDelDia: number;
}

function formatYMD(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

const VISIBLES_INICIAL = 6;

export function CierresAnteriores({ cierres }: { cierres: CierreResumenRow[] }) {
  const [expandido, setExpandido] = useState(false);
  const visibles = expandido ? cierres : cierres.slice(0, VISIBLES_INICIAL);
  const ocultos = cierres.length - visibles.length;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Fecha</th>
              <th className="px-4 py-3 text-left font-medium">Cerrado por</th>
              <th className="px-4 py-3 text-right font-medium">Total del día</th>
              <th className="w-20 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibles.map((item) => (
              <tr key={item.id} className="hover:bg-cream/30">
                <td className="px-4 py-3 font-medium tabular-nums">
                  {formatYMD(item.fecha)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {item.cerradoPor}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatARS(item.totalDelDia)}
                </td>
                <td className="px-4 py-3 text-right">
                  <TableActionLink href={`/caja/${item.id}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cierres.length > VISIBLES_INICIAL && (
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-sage-700 transition-colors hover:bg-cream hover:text-sage-900"
        >
          {expandido ? "Ver menos" : `Ver ${ocultos} cierres más`}
          <ChevronDown
            className={`h-4 w-4 stroke-[1.5] transition-transform ${
              expandido ? "rotate-180" : ""
            }`}
          />
        </button>
      )}
    </div>
  );
}
