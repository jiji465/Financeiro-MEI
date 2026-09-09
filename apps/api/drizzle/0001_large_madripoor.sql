CREATE TYPE "public"."status_solicitacao" AS ENUM('pendente', 'aprovada', 'recusada');--> statement-breakpoint
CREATE TABLE "solicitacoes_acesso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"telefone" text,
	"atividade" "atividade",
	"mensagem" text,
	"status" "status_solicitacao" DEFAULT 'pendente' NOT NULL,
	"observacao_admin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "admin" boolean DEFAULT false NOT NULL;