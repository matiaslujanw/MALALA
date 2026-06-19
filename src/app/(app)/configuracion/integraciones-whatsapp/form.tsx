"use client";

import { useActionStateFeedback } from "@/components/feedback/action-feedback";
import { LoadingButton } from "@/components/forms/field";
import { upsertIntegracionManychatAction } from "@/lib/data/integraciones-manychat";
import type { IntegracionManychatRow } from "@/lib/data/integraciones-manychat";

interface Props {
  integ: IntegracionManychatRow;
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  type = "text",
  hint,
  required,
  error,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  type?: string;
  hint?: string;
  required?: boolean;
  error?: string[];
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-ink">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
        className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink/30"
      />
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="mt-1 text-xs text-rose-600">{error[0]}</p>}
    </label>
  );
}

export function IntegracionManychatForm({ integ }: Props) {
  const [state, action, pending] = useActionStateFeedback(
    upsertIntegracionManychatAction,
    {
      refreshOnSuccess: true,
      successMessage: "Integracion guardada",
    },
  );

  const fieldErrors = state && !state.ok ? state.errors : {};
  const globalError = fieldErrors._?.[0];

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="sucursal_id" value={integ.sucursal_id} />

      <Field
        label="API key de ManyChat"
        name="api_key"
        type="password"
        placeholder={integ.api_key_set ? "••••••• (dejar vacío para conservar)" : "Bearer token"}
        hint="Se conserva la actual si lo dejás vacío"
        error={fieldErrors.api_key}
      />
      <Field
        label="Número de WhatsApp"
        name="numero_whatsapp"
        defaultValue={integ.numero_whatsapp_e164}
        placeholder="+5493815557777"
        required
        error={fieldErrors.numero_whatsapp}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label="Flow confirmación"
          name="flow_ns_confirmacion"
          defaultValue={integ.flow_ns_confirmacion}
          placeholder="content20240101000000_000000"
          error={fieldErrors.flow_ns_confirmacion}
        />
        <Field
          label="Flow recordatorio 2h"
          name="flow_ns_recordatorio_2h"
          defaultValue={integ.flow_ns_recordatorio_2h}
          error={fieldErrors.flow_ns_recordatorio_2h}
        />
        <Field
          label="Flow cancelación"
          name="flow_ns_cancelacion"
          defaultValue={integ.flow_ns_cancelacion}
          error={fieldErrors.flow_ns_cancelacion}
        />
        <Field
          label="Flow reprogramación"
          name="flow_ns_reprogramacion"
          defaultValue={integ.flow_ns_reprogramacion}
          error={fieldErrors.flow_ns_reprogramacion}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="activo"
          defaultChecked={integ.activo}
          className="rounded border-border"
        />
        <span>Integración activa</span>
      </label>

      {globalError && <p className="text-sm text-rose-600">{globalError}</p>}

      <div className="flex justify-end">
        <LoadingButton
          type="submit"
          pending={pending}
          pendingLabel="Guardando..."
          className="rounded-xl bg-ink px-4 py-2 text-sm font-medium text-white"
        >
          Guardar
        </LoadingButton>
      </div>
    </form>
  );
}
