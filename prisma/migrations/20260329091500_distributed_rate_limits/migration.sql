CREATE TABLE "ApiRateLimit" (
    "namespace" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiRateLimit_pkey" PRIMARY KEY ("namespace","identifier")
);

CREATE INDEX "ApiRateLimit_resetAt_idx" ON "ApiRateLimit"("resetAt");
