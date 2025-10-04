ALTER TABLE "UserLoadout" ADD COLUMN "selectedTools" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "UserLoadout" DROP COLUMN IF EXISTS "selectedToolIds";--> statement-breakpoint
ALTER TABLE "UserLoadout" DROP COLUMN IF EXISTS "selectedAgentIds";