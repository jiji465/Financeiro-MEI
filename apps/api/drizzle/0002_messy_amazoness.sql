ALTER TABLE "tenants" ADD COLUMN "interno" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deve_trocar_senha" boolean DEFAULT false NOT NULL;