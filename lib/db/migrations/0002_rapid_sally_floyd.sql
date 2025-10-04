CREATE TABLE IF NOT EXISTS "UserLoadout" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"isDefault" boolean DEFAULT false NOT NULL,
	"selectedToolIds" jsonb DEFAULT '[]'::jsonb,
	"selectedAgentIds" jsonb DEFAULT '[]'::jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserLoadout" ADD CONSTRAINT "UserLoadout_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
