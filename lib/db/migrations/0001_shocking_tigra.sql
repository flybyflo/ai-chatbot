CREATE TABLE IF NOT EXISTS "UserMCPServer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"url" text NOT NULL,
	"description" text,
	"headers" jsonb DEFAULT '{}'::jsonb,
	"isActive" boolean DEFAULT true NOT NULL,
	"lastConnectionTest" timestamp,
	"lastConnectionStatus" varchar(50),
	"lastError" text,
	"toolCount" integer DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserMCPServer" ADD CONSTRAINT "UserMCPServer_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
