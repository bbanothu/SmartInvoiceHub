CREATE TABLE `Invoice` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`customerName` text NOT NULL,
	`vendorName` text NOT NULL,
	`invoiceNumber` text NOT NULL,
	`invoiceDate` integer NOT NULL,
	`dueDate` integer NOT NULL,
	`amount` real NOT NULL,
	`fileUrl` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `LineItem` (
	`id` text PRIMARY KEY NOT NULL,
	`invoiceId` text NOT NULL,
	`description` text NOT NULL,
	`quantity` real NOT NULL,
	`unitPrice` real NOT NULL,
	`total` real NOT NULL,
	FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `TokenUsage` (
	`id` text PRIMARY KEY NOT NULL,
	`invoiceId` text NOT NULL,
	`inputTokens` integer NOT NULL,
	`outputTokens` integer NOT NULL,
	`cost` real NOT NULL,
	`timestamp` integer NOT NULL,
	FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `Document` ADD `userId` text NOT NULL;