CREATE TABLE "profesionales_servicios" (
	"id" text PRIMARY KEY NOT NULL,
	"empleado_id" text NOT NULL,
	"sucursal_id" text NOT NULL,
	"servicio_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profesionales_servicios" ADD CONSTRAINT "profesionales_servicios_empleado_id_empleados_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleados"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "profesionales_servicios" ADD CONSTRAINT "profesionales_servicios_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "profesionales_servicios" ADD CONSTRAINT "profesionales_servicios_servicio_id_servicios_id_fk" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicios"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "profesionales_servicios_empleado_sucursal_servicio_uq" ON "profesionales_servicios" USING btree ("empleado_id","sucursal_id","servicio_id");
--> statement-breakpoint
CREATE INDEX "profesionales_servicios_sucursal_empleado_idx" ON "profesionales_servicios" USING btree ("sucursal_id","empleado_id");
