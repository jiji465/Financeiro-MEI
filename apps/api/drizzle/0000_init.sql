CREATE TYPE "public"."atividade" AS ENUM('comercio', 'servicos', 'comercio_servicos', 'caminhoneiro');--> statement-breakpoint
CREATE TYPE "public"."caminhoneiro_tributos" AS ENUM('icms', 'iss', 'ambos');--> statement-breakpoint
CREATE TYPE "public"."forma_pagamento" AS ENUM('pix', 'dinheiro', 'cartao', 'boleto', 'transferencia', 'outro');--> statement-breakpoint
CREATE TYPE "public"."grupo_dasn" AS ENUM('comercio', 'servicos');--> statement-breakpoint
CREATE TYPE "public"."origem_lancamento" AS ENUM('manual', 'recorrencia', 'baixa', 'das', 'importacao', 'nota_fiscal');--> statement-breakpoint
CREATE TYPE "public"."regime_apuracao" AS ENUM('competencia', 'caixa');--> statement-breakpoint
CREATE TYPE "public"."status_dasn" AS ENUM('pendente', 'entregue');--> statement-breakpoint
CREATE TYPE "public"."status_lancamento" AS ENUM('pago', 'pendente');--> statement-breakpoint
CREATE TYPE "public"."status_nota" AS ENUM('emitida', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."status_parcela" AS ENUM('aberta', 'paga', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."status_titulo" AS ENUM('aberto', 'quitado', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."tipo_contato" AS ENUM('cliente', 'fornecedor', 'ambos');--> statement-breakpoint
CREATE TYPE "public"."tipo_lancamento" AS ENUM('receita', 'despesa');--> statement-breakpoint
CREATE TYPE "public"."tipo_nota" AS ENUM('nfe', 'nfse', 'nfce');--> statement-breakpoint
CREATE TYPE "public"."tipo_titulo" AS ENUM('pagar', 'receber');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'membro');--> statement-breakpoint
CREATE TABLE "configuracoes" (
	"tenant_id" uuid NOT NULL,
	"regime_apuracao" "regime_apuracao" DEFAULT 'competencia' NOT NULL,
	"dias_alerta_vencimento" integer DEFAULT 7 NOT NULL,
	"dias_alerta_das" integer DEFAULT 7 NOT NULL,
	"mostrar_projecao" boolean DEFAULT true NOT NULL,
	"categoria_das_id" uuid,
	"preferencias" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "configuracoes_pkey" PRIMARY KEY("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"nome_fantasia" text,
	"cnpj" varchar(14),
	"atividade" "atividade" NOT NULL,
	"caminhoneiro_tributos" "caminhoneiro_tributos",
	"data_abertura" date,
	"email_contato" text,
	"telefone" text,
	"endereco" jsonb,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_cnpj_unique" UNIQUE("cnpj")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"replaced_by_id" uuid,
	"user_agent" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"senha_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'owner' NOT NULL,
	"ultimo_login_at" timestamp with time zone,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_tenant_id_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "parametros_mei" (
	"ano" integer PRIMARY KEY NOT NULL,
	"salario_minimo" integer NOT NULL,
	"aliquota_inss_bp" integer DEFAULT 500 NOT NULL,
	"aliquota_inss_caminhoneiro_bp" integer DEFAULT 1200 NOT NULL,
	"icms" integer DEFAULT 100 NOT NULL,
	"iss" integer DEFAULT 500 NOT NULL,
	"limite_anual" integer DEFAULT 8100000 NOT NULL,
	"limite_mensal_proporcional" integer DEFAULT 675000 NOT NULL,
	"tolerancia_excesso_bp" integer DEFAULT 2000 NOT NULL,
	"dia_vencimento_das" integer DEFAULT 20 NOT NULL,
	"dasn_prazo_dia" integer DEFAULT 31 NOT NULL,
	"dasn_prazo_mes" integer DEFAULT 5 NOT NULL,
	"alertas_limite_pct" jsonb DEFAULT '[70,85,100]'::jsonb NOT NULL,
	"confirmado" boolean DEFAULT true NOT NULL,
	"observacoes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categorias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"tipo" "tipo_lancamento" NOT NULL,
	"grupo_dasn" "grupo_dasn",
	"cor" text,
	"icone" text,
	"padrao" boolean DEFAULT false NOT NULL,
	"sistema" boolean DEFAULT false NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categorias_tenant_id_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "contatos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tipo" "tipo_contato" NOT NULL,
	"nome" text NOT NULL,
	"documento" varchar(14),
	"tipo_documento" varchar(4),
	"email" text,
	"telefone" text,
	"logradouro" text,
	"numero" text,
	"complemento" text,
	"bairro" text,
	"cidade" text,
	"uf" varchar(2),
	"cep" varchar(8),
	"observacoes" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "contatos_tenant_id_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "lancamentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tipo" "tipo_lancamento" NOT NULL,
	"data" date NOT NULL,
	"valor" integer NOT NULL,
	"descricao" text NOT NULL,
	"categoria_id" uuid NOT NULL,
	"contato_id" uuid,
	"forma_pagamento" "forma_pagamento" DEFAULT 'pix' NOT NULL,
	"status" "status_lancamento" DEFAULT 'pago' NOT NULL,
	"data_pagamento" date,
	"observacoes" text,
	"anexo_path" text,
	"anexo_nome" text,
	"anexo_mime" text,
	"anexo_tamanho" integer,
	"origem" "origem_lancamento" DEFAULT 'manual' NOT NULL,
	"recorrencia_id" uuid,
	"competencia" date,
	"parcela_id" uuid,
	"importacao_id" uuid,
	"hash_importacao" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "lancamentos_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "lancamentos_valor_positivo" CHECK ("lancamentos"."valor" > 0)
);
--> statement-breakpoint
CREATE TABLE "recorrencias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tipo" "tipo_lancamento" NOT NULL,
	"valor" integer NOT NULL,
	"descricao" text NOT NULL,
	"categoria_id" uuid NOT NULL,
	"contato_id" uuid,
	"forma_pagamento" "forma_pagamento" DEFAULT 'pix' NOT NULL,
	"dia_do_mes" integer NOT NULL,
	"data_inicio" date NOT NULL,
	"data_fim" date,
	"ativo" boolean DEFAULT true NOT NULL,
	"ultima_competencia" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recorrencias_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "recorrencias_valor_positivo" CHECK ("recorrencias"."valor" > 0),
	CONSTRAINT "recorrencias_dia_do_mes_valido" CHECK ("recorrencias"."dia_do_mes" between 1 and 31)
);
--> statement-breakpoint
CREATE TABLE "parcelas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"titulo_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"vencimento" date NOT NULL,
	"valor" integer NOT NULL,
	"status" "status_parcela" DEFAULT 'aberta' NOT NULL,
	"lancamento_id" uuid,
	"data_pagamento" date,
	"valor_pago" integer,
	"forma_pagamento" "forma_pagamento",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parcelas_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "parcelas_titulo_numero_unique" UNIQUE("titulo_id","numero"),
	CONSTRAINT "parcelas_valor_positivo" CHECK ("parcelas"."valor" > 0),
	CONSTRAINT "parcelas_numero_positivo" CHECK ("parcelas"."numero" >= 1)
);
--> statement-breakpoint
CREATE TABLE "titulos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tipo" "tipo_titulo" NOT NULL,
	"descricao" text NOT NULL,
	"contato_id" uuid,
	"categoria_id" uuid NOT NULL,
	"valor_total" integer NOT NULL,
	"numero_parcelas" integer DEFAULT 1 NOT NULL,
	"data_emissao" date NOT NULL,
	"nota_fiscal_id" uuid,
	"status" "status_titulo" DEFAULT 'aberto' NOT NULL,
	"observacoes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "titulos_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "titulos_valor_total_positivo" CHECK ("titulos"."valor_total" > 0),
	CONSTRAINT "titulos_numero_parcelas_positivo" CHECK ("titulos"."numero_parcelas" >= 1)
);
--> statement-breakpoint
CREATE TABLE "notas_fiscais" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tipo" "tipo_nota" NOT NULL,
	"numero" text NOT NULL,
	"serie" text DEFAULT '1' NOT NULL,
	"data_emissao" date NOT NULL,
	"contato_id" uuid,
	"valor" integer NOT NULL,
	"descricao" text,
	"status" "status_nota" DEFAULT 'emitida' NOT NULL,
	"data_cancelamento" date,
	"motivo_cancelamento" text,
	"lancamento_id" uuid,
	"link_externo" text,
	"arquivo_path" text,
	"arquivo_nome" text,
	"arquivo_mime" text,
	"provedor" text DEFAULT 'manual' NOT NULL,
	"chave_acesso" varchar(44),
	"protocolo" text,
	"ambiente" text,
	"xml_path" text,
	"provedor_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "notas_fiscais_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "notas_fiscais_valor_positivo" CHECK ("notas_fiscais"."valor" > 0)
);
--> statement-breakpoint
CREATE TABLE "alertas_dispensados" (
	"tenant_id" uuid NOT NULL,
	"chave" text NOT NULL,
	"dispensado_ate" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alertas_dispensados_pkey" PRIMARY KEY("tenant_id","chave")
);
--> statement-breakpoint
CREATE TABLE "das_pagamentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"competencia" date NOT NULL,
	"valor_calculado" integer NOT NULL,
	"valor_pago" integer NOT NULL,
	"data_pagamento" date NOT NULL,
	"forma_pagamento" "forma_pagamento" DEFAULT 'pix' NOT NULL,
	"lancamento_id" uuid,
	"observacao" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "das_pagamentos_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "das_pagamentos_tenant_competencia_unique" UNIQUE("tenant_id","competencia"),
	CONSTRAINT "das_pagamentos_valor_pago_nao_negativo" CHECK ("das_pagamentos"."valor_pago" >= 0)
);
--> statement-breakpoint
CREATE TABLE "dasn_declaracoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"ano_base" integer NOT NULL,
	"faturamento_apurado" integer DEFAULT 0 NOT NULL,
	"receita_comercio" integer DEFAULT 0 NOT NULL,
	"receita_servicos" integer DEFAULT 0 NOT NULL,
	"faturamento_declarado" integer,
	"status" "status_dasn" DEFAULT 'pendente' NOT NULL,
	"data_entrega" date,
	"numero_recibo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dasn_declaracoes_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "dasn_declaracoes_tenant_ano_base_unique" UNIQUE("tenant_id","ano_base")
);
--> statement-breakpoint
CREATE TABLE "importacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nome_arquivo" text NOT NULL,
	"formato" text DEFAULT 'csv' NOT NULL,
	"total_linhas" integer DEFAULT 0 NOT NULL,
	"importadas" integer DEFAULT 0 NOT NULL,
	"ignoradas" integer DEFAULT 0 NOT NULL,
	"duplicadas" integer DEFAULT 0 NOT NULL,
	"mapeamento" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "importacoes_tenant_id_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "configuracoes" ADD CONSTRAINT "configuracoes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configuracoes" ADD CONSTRAINT "configuracoes_categoria_das_fk" FOREIGN KEY ("tenant_id","categoria_das_id") REFERENCES "public"."categorias"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_replaced_by_id_refresh_tokens_id_fk" FOREIGN KEY ("replaced_by_id") REFERENCES "public"."refresh_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contatos" ADD CONSTRAINT "contatos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_categoria_fk" FOREIGN KEY ("tenant_id","categoria_id") REFERENCES "public"."categorias"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_contato_fk" FOREIGN KEY ("tenant_id","contato_id") REFERENCES "public"."contatos"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_recorrencia_fk" FOREIGN KEY ("tenant_id","recorrencia_id") REFERENCES "public"."recorrencias"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_importacao_fk" FOREIGN KEY ("tenant_id","importacao_id") REFERENCES "public"."importacoes"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recorrencias" ADD CONSTRAINT "recorrencias_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recorrencias" ADD CONSTRAINT "recorrencias_categoria_fk" FOREIGN KEY ("tenant_id","categoria_id") REFERENCES "public"."categorias"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recorrencias" ADD CONSTRAINT "recorrencias_contato_fk" FOREIGN KEY ("tenant_id","contato_id") REFERENCES "public"."contatos"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcelas" ADD CONSTRAINT "parcelas_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcelas" ADD CONSTRAINT "parcelas_titulo_fk" FOREIGN KEY ("tenant_id","titulo_id") REFERENCES "public"."titulos"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcelas" ADD CONSTRAINT "parcelas_lancamento_fk" FOREIGN KEY ("tenant_id","lancamento_id") REFERENCES "public"."lancamentos"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "titulos" ADD CONSTRAINT "titulos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "titulos" ADD CONSTRAINT "titulos_contato_fk" FOREIGN KEY ("tenant_id","contato_id") REFERENCES "public"."contatos"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "titulos" ADD CONSTRAINT "titulos_categoria_fk" FOREIGN KEY ("tenant_id","categoria_id") REFERENCES "public"."categorias"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "titulos" ADD CONSTRAINT "titulos_nota_fiscal_fk" FOREIGN KEY ("tenant_id","nota_fiscal_id") REFERENCES "public"."notas_fiscais"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_contato_fk" FOREIGN KEY ("tenant_id","contato_id") REFERENCES "public"."contatos"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_fiscais" ADD CONSTRAINT "notas_fiscais_lancamento_fk" FOREIGN KEY ("tenant_id","lancamento_id") REFERENCES "public"."lancamentos"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas_dispensados" ADD CONSTRAINT "alertas_dispensados_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "das_pagamentos" ADD CONSTRAINT "das_pagamentos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "das_pagamentos" ADD CONSTRAINT "das_pagamentos_lancamento_fk" FOREIGN KEY ("tenant_id","lancamento_id") REFERENCES "public"."lancamentos"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dasn_declaracoes" ADD CONSTRAINT "dasn_declaracoes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "importacoes" ADD CONSTRAINT "importacoes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_tenant_idx" ON "users" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categorias_tenant_tipo_nome_idx" ON "categorias" USING btree ("tenant_id","tipo",lower("nome"));--> statement-breakpoint
CREATE INDEX "categorias_tenant_tipo_idx" ON "categorias" USING btree ("tenant_id","tipo");--> statement-breakpoint
CREATE UNIQUE INDEX "contatos_tenant_documento_idx" ON "contatos" USING btree ("tenant_id","documento") WHERE "contatos"."documento" is not null and "contatos"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "contatos_tenant_tipo_idx" ON "contatos" USING btree ("tenant_id","tipo");--> statement-breakpoint
CREATE INDEX "contatos_tenant_nome_idx" ON "contatos" USING btree ("tenant_id","nome");--> statement-breakpoint
CREATE UNIQUE INDEX "lancamentos_parcela_idx" ON "lancamentos" USING btree ("parcela_id") WHERE "lancamentos"."parcela_id" is not null and "lancamentos"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "lancamentos_hash_importacao_idx" ON "lancamentos" USING btree ("tenant_id","hash_importacao") WHERE "lancamentos"."hash_importacao" is not null and "lancamentos"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "lancamentos_recorrencia_competencia_idx" ON "lancamentos" USING btree ("recorrencia_id","competencia") WHERE "lancamentos"."recorrencia_id" is not null and "lancamentos"."competencia" is not null;--> statement-breakpoint
CREATE INDEX "lancamentos_tenant_data_idx" ON "lancamentos" USING btree ("tenant_id","data");--> statement-breakpoint
CREATE INDEX "lancamentos_tenant_tipo_status_data_idx" ON "lancamentos" USING btree ("tenant_id","tipo","status","data");--> statement-breakpoint
CREATE INDEX "lancamentos_tenant_categoria_idx" ON "lancamentos" USING btree ("tenant_id","categoria_id");--> statement-breakpoint
CREATE INDEX "lancamentos_tenant_contato_idx" ON "lancamentos" USING btree ("tenant_id","contato_id");--> statement-breakpoint
CREATE INDEX "recorrencias_tenant_ativo_idx" ON "recorrencias" USING btree ("tenant_id","ativo");--> statement-breakpoint
CREATE INDEX "parcelas_tenant_status_vencimento_idx" ON "parcelas" USING btree ("tenant_id","status","vencimento");--> statement-breakpoint
CREATE INDEX "parcelas_tenant_titulo_idx" ON "parcelas" USING btree ("tenant_id","titulo_id");--> statement-breakpoint
CREATE INDEX "titulos_tenant_tipo_status_idx" ON "titulos" USING btree ("tenant_id","tipo","status");--> statement-breakpoint
CREATE INDEX "titulos_tenant_contato_idx" ON "titulos" USING btree ("tenant_id","contato_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notas_fiscais_tenant_tipo_serie_numero_idx" ON "notas_fiscais" USING btree ("tenant_id","tipo","serie","numero") WHERE "notas_fiscais"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "notas_fiscais_tenant_data_idx" ON "notas_fiscais" USING btree ("tenant_id","data_emissao");--> statement-breakpoint
CREATE INDEX "notas_fiscais_tenant_contato_idx" ON "notas_fiscais" USING btree ("tenant_id","contato_id");--> statement-breakpoint
CREATE INDEX "alertas_dispensados_tenant_idx" ON "alertas_dispensados" USING btree ("tenant_id");