CREATE TYPE "public"."network" AS ENUM('nano', 'bitcoin');--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"network" "network" NOT NULL,
	"contract" text,
	"user_id" text NOT NULL,
	"address" text NOT NULL,
	"amount" numeric(39,0) NOT NULL,
	"hash" "bytea" NOT NULL,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nano_account" (
	"address" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"index" integer NOT NULL,
	CONSTRAINT "nano_account_userId_index_unique" UNIQUE("user_id","index")
);
--> statement-breakpoint
CREATE TABLE "nano_receivable" (
	"block_hash" "bytea" PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"amount" numeric(39,0) NOT NULL,
	"source" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nano_account" ADD CONSTRAINT "nano_account_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nano_receivable" ADD CONSTRAINT "nano_receivable_address_nano_account_address_fk" FOREIGN KEY ("address") REFERENCES "public"."nano_account"("address") ON DELETE no action ON UPDATE no action;