"use server";

import type { CreateIngresoResult } from "./ingresos";
import { createIngreso as createIngresoImpl } from "./ingresos";

export async function createIngreso(formData: FormData): Promise<CreateIngresoResult> {
  return createIngresoImpl(formData);
}
