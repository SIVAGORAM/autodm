CREATE TABLE "meta_deauthorization_receipts" (
    "id" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_deauthorization_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meta_deauthorization_receipts_requestHash_key"
    ON "meta_deauthorization_receipts"("requestHash");

CREATE INDEX "meta_deauthorization_receipts_createdAt_idx"
    ON "meta_deauthorization_receipts"("createdAt");
