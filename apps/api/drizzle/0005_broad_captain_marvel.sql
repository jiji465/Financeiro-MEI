CREATE TYPE "public"."tipo_produto_servico" AS ENUM('produto', 'servico');--> statement-breakpoint
CREATE TABLE "lancamento_itens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lancamento_id" uuid NOT NULL,
	"produto_servico_id" uuid NOT NULL,
	"quantidade" integer NOT NULL,
	"valor_unitario" integer NOT NULL,
	"valor_total" integer NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lancamento_itens_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "lancamento_itens_quantidade_positiva" CHECK ("lancamento_itens"."quantidade" > 0),
	CONSTRAINT "lancamento_itens_valor_unitario_nao_negativo" CHECK ("lancamento_itens"."valor_unitario" >= 0),
	CONSTRAINT "lancamento_itens_valor_total_nao_negativo" CHECK ("lancamento_itens"."valor_total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "produtos_servicos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tipo" "tipo_produto_servico" NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"preco_padrao" integer,
	"unidade" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "produtos_servicos_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "produtos_servicos_preco_nao_negativo" CHECK ("produtos_servicos"."preco_padrao" is null or "produtos_servicos"."preco_padrao" >= 0)
);
--> statement-breakpoint
ALTER TABLE "lancamento_itens" ADD CONSTRAINT "lancamento_itens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento_itens" ADD CONSTRAINT "lancamento_itens_lancamento_fk" FOREIGN KEY ("tenant_id","lancamento_id") REFERENCES "public"."lancamentos"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento_itens" ADD CONSTRAINT "lancamento_itens_produto_servico_fk" FOREIGN KEY ("tenant_id","produto_servico_id") REFERENCES "public"."produtos_servicos"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produtos_servicos" ADD CONSTRAINT "produtos_servicos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lancamento_itens_tenant_lancamento_idx" ON "lancamento_itens" USING btree ("tenant_id","lancamento_id");--> statement-breakpoint
CREATE INDEX "lancamento_itens_tenant_produto_servico_idx" ON "lancamento_itens" USING btree ("tenant_id","produto_servico_id");--> statement-breakpoint
CREATE UNIQUE INDEX "produtos_servicos_tenant_nome_idx" ON "produtos_servicos" USING btree ("tenant_id",lower("nome")) WHERE "produtos_servicos"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "produtos_servicos_tenant_tipo_ativo_idx" ON "produtos_servicos" USING btree ("tenant_id","tipo","ativo");