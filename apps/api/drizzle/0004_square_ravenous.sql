CREATE TYPE "public"."tipo_conta_bancaria" AS ENUM('corrente', 'poupanca', 'pagamento', 'dinheiro');--> statement-breakpoint
CREATE TABLE "contas_bancarias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"instituicao" text,
	"tipo" "tipo_conta_bancaria" DEFAULT 'corrente' NOT NULL,
	"saldo_inicial" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "contas_bancarias_tenant_id_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "lancamentos" ADD COLUMN "conta_bancaria_id" uuid;--> statement-breakpoint
ALTER TABLE "contas_bancarias" ADD CONSTRAINT "contas_bancarias_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contas_bancarias_tenant_nome_idx" ON "contas_bancarias" USING btree ("tenant_id",lower("nome")) WHERE "contas_bancarias"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "contas_bancarias_tenant_ativo_idx" ON "contas_bancarias" USING btree ("tenant_id","ativo");--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_conta_bancaria_fk" FOREIGN KEY ("tenant_id","conta_bancaria_id") REFERENCES "public"."contas_bancarias"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lancamentos_tenant_conta_bancaria_idx" ON "lancamentos" USING btree ("tenant_id","conta_bancaria_id");