CREATE TYPE "ContactEnquiryStatus" AS ENUM (
  'NEW', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED', 'SPAM'
);
CREATE TYPE "ContactEnquiryPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "ContactEnquiryMessageKind" AS ENUM ('SUBMISSION', 'ADMIN_REPLY', 'INTERNAL_NOTE');
CREATE TYPE "ContactEmailDeliveryStatus" AS ENUM ('NOT_APPLICABLE', 'QUEUED', 'SENT', 'FAILED', 'CANCELLED');

CREATE TABLE "contact_enquiries" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "status" "ContactEnquiryStatus" NOT NULL DEFAULT 'NEW',
  "priority" "ContactEnquiryPriority" NOT NULL DEFAULT 'NORMAL',
  "assignedAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contact_enquiries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contact_enquiry_messages" (
  "id" TEXT NOT NULL,
  "enquiryId" TEXT NOT NULL,
  "authorAdminId" TEXT,
  "kind" "ContactEnquiryMessageKind" NOT NULL,
  "body" TEXT NOT NULL,
  "emailDeliveryStatus" "ContactEmailDeliveryStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contact_enquiry_messages_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "mail_outbox"
  ADD COLUMN "contactEnquiryMessageId" TEXT;

CREATE UNIQUE INDEX "mail_outbox_contactEnquiryMessageId_key"
  ON "mail_outbox"("contactEnquiryMessageId");
CREATE INDEX "contact_enquiries_status_priority_updatedAt_idx"
  ON "contact_enquiries"("status", "priority", "updatedAt");
CREATE INDEX "contact_enquiries_assignedAdminId_status_updatedAt_idx"
  ON "contact_enquiries"("assignedAdminId", "status", "updatedAt");
CREATE INDEX "contact_enquiries_email_createdAt_idx"
  ON "contact_enquiries"("email", "createdAt");
CREATE INDEX "contact_enquiry_messages_enquiryId_createdAt_id_idx"
  ON "contact_enquiry_messages"("enquiryId", "createdAt", "id");
CREATE INDEX "contact_enquiry_messages_authorAdminId_createdAt_idx"
  ON "contact_enquiry_messages"("authorAdminId", "createdAt");

ALTER TABLE "contact_enquiries" ADD CONSTRAINT "contact_enquiries_assignedAdminId_fkey"
  FOREIGN KEY ("assignedAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contact_enquiry_messages" ADD CONSTRAINT "contact_enquiry_messages_enquiryId_fkey"
  FOREIGN KEY ("enquiryId") REFERENCES "contact_enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contact_enquiry_messages" ADD CONSTRAINT "contact_enquiry_messages_authorAdminId_fkey"
  FOREIGN KEY ("authorAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mail_outbox" ADD CONSTRAINT "mail_outbox_contactEnquiryMessageId_fkey"
  FOREIGN KEY ("contactEnquiryMessageId") REFERENCES "contact_enquiry_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
