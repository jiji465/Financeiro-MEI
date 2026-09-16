CREATE TABLE "transferencias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"data" date NOT NULL,
	"valor" integer NOT NULL,
	"conta_origem_id" uuid NOT NULL,
	"conta_destino_id" uuid NOT NULL,
	"descricao" text,
	"observacoes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "transferencias_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "transferencias_valor_positivo" CHECK ("transferencias"."valor" > 0),
	CONSTRAINT "transferencias_contas_diferentes" CHECK ("transferencias"."conta_origem_id" <> "transferencias"."conta_destino_id")
);
--> statement-breakpoint
ALTER TABLE "transferencias" ADD CONSTRAINT "transferencias_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transferencias" ADD CONSTRAINT "transferencias_conta_origem_fk" FOREIGN KEY ("tenant_id","conta_origem_id") REFERENCES "public"."contas_bancarias"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transferencias" ADD CONSTRAINT "transferencias_conta_destino_fk" FOREIGN KEY ("tenant_id","conta_destino_id") REFERENCES "public"."contas_bancarias"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transferencias_tenant_data_idx" ON "transferencias" USING btree ("tenant_id","data");--> statement-breakpoint
CREATE INDEX "transferencias_tenant_origem_idx" ON "transferencias" USING btree ("tenant_id","conta_origem_id");--> statement-breakpoint
CREATE INDEX "transferencias_tenant_destino_idx" ON "transferencias" USING btree ("tenant_id","conta_destino_id");