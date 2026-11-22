CREATE TABLE "meta_data_deletion_requests" (
    "id" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "confirmationCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_data_deletion_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meta_data_deletion_requests_requestHash_key"
    ON "meta_data_deletion_requests"("requestHash");

CREATE UNIQUE INDEX "meta_data_deletion_requests_confirmationCode_key"
    ON "meta_data_deletion_requests"("confirmationCode");

CREATE INDEX "meta_data_deletion_requests_createdAt_idx"
    ON "meta_data_deletion_requests"("createdAt");
