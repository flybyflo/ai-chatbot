CREATE TABLE IF NOT EXISTS "UserA2AServer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"cardUrl" text NOT NULL,
	"description" text,
	"headers" jsonb DEFAULT '{}'::jsonb,
	"isActive" boolean DEFAULT true NOT NULL,
	"lastConnectionTest" timestamp,
	"lastConnectionStatus" varchar(50),
	"lastError" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserA2AServer" ADD CONSTRAINT "UserA2AServer_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
