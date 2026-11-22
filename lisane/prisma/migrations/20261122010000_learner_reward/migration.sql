-- CreateTable
CREATE TABLE "learner_reward" (
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "lastDay" TEXT,

    CONSTRAINT "learner_reward_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "learner_reward" ADD CONSTRAINT "learner_reward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
