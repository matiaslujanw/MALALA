"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { FormButtons, GlobalError } from "./field";
import type { ActionResult } from "@/lib/data/_helpers";

interface Props {
  action: (
    state: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
  redirectTo: string;
  submitLabel: string;
  cancelHref?: string;
  children: (errors: Record<string, string[]>) => React.ReactNode;
}

export function CrudForm({
  action,
  redirectTo,
  submitLabel,
  cancelHref,
  children,
}: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(async (prev, fd) => {
    const result = await action(prev, fd);
    if (result.ok) {
      router.push(redirectTo);
      router.refresh();
    }
    return result;
  }, null);

  const errors = state && !state.ok ? state.errors : {};

  return (
    <form action={formAction} className="space-y-5 max-w-xl">
      {children(errors)}
      <GlobalError error={errors._} />
      <FormButtons
        cancelHref={cancelHref ?? redirectTo}
        submitLabel={submitLabel}
        pending={pending}
      />
    </form>
  );
}
