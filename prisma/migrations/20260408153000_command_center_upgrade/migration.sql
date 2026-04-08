-- CreateTable
CREATE TABLE "UserWorkspace" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "panelOrder" TEXT NOT NULL DEFAULT '["risk","narratives","market","watchlist","briefing"]',
    "collapsedPanels" TEXT NOT NULL DEFAULT '[]',
    "pinnedRegions" TEXT NOT NULL DEFAULT '[]',
    "pinnedSymbols" TEXT NOT NULL DEFAULT '[]',
    "defaultTimeWindow" TEXT NOT NULL DEFAULT '24h',
    "defaultSort" TEXT NOT NULL DEFAULT 'relevance',
    "activeView" TEXT NOT NULL DEFAULT 'command',
    "density" TEXT NOT NULL DEFAULT 'comfortable',
    "layoutMode" TEXT NOT NULL DEFAULT 'focus',
    "railCollapsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWorkspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskSnapshot" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "scopeLabel" TEXT NOT NULL,
    "snapshotWindow" TEXT NOT NULL DEFAULT '72h',
    "riskScore" DOUBLE PRECISION NOT NULL,
    "trend" TEXT NOT NULL,
    "heatLevel" TEXT NOT NULL,
    "storyCount" INTEGER NOT NULL,
    "supportScore" DOUBLE PRECISION NOT NULL,
    "marketPressure" DOUBLE PRECISION NOT NULL,
    "narrativeCount" INTEGER NOT NULL DEFAULT 0,
    "topSymbol" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserWorkspace_userId_key" ON "UserWorkspace"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskSnapshot_scopeType_scopeKey_snapshotWindow_key" ON "RiskSnapshot"("scopeType", "scopeKey", "snapshotWindow");

-- CreateIndex
CREATE INDEX "RiskSnapshot_scopeType_snapshotWindow_riskScore_idx" ON "RiskSnapshot"("scopeType", "snapshotWindow", "riskScore");

-- AddForeignKey
ALTER TABLE "UserWorkspace" ADD CONSTRAINT "UserWorkspace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
