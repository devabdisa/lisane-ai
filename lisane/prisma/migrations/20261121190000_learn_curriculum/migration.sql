-- CreateTable
CREATE TABLE "curriculum_unit" (
    "id" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "review" JSONB NOT NULL,
    "guidebook" JSONB NOT NULL,
    "phrases" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "curriculum_unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_level" (
    "unitId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "curriculum_level_pkey" PRIMARY KEY ("unitId","id")
);

-- CreateTable
CREATE TABLE "level_progress" (
    "userId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "level_progress_pkey" PRIMARY KEY ("userId","unitId","levelId")
);

-- CreateIndex
CREATE INDEX "curriculum_unit_active_section_position_idx" ON "curriculum_unit"("active", "section", "position");

-- CreateIndex
CREATE INDEX "curriculum_level_unitId_active_position_idx" ON "curriculum_level"("unitId", "active", "position");

-- CreateIndex
CREATE INDEX "level_progress_unitId_levelId_idx" ON "level_progress"("unitId", "levelId");

-- AddForeignKey
ALTER TABLE "curriculum_level" ADD CONSTRAINT "curriculum_level_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "curriculum_unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "level_progress" ADD CONSTRAINT "level_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "level_progress" ADD CONSTRAINT "level_progress_unitId_levelId_fkey" FOREIGN KEY ("unitId", "levelId") REFERENCES "curriculum_level"("unitId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
