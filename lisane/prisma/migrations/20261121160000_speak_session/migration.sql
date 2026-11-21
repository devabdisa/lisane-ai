-- CreateTable
CREATE TABLE "speak_session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "speak_session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "speak_session_userId_idx" ON "speak_session"("userId");

-- AddForeignKey
ALTER TABLE "speak_session" ADD CONSTRAINT "speak_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
