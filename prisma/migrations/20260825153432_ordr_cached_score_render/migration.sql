-- CreateTable
CREATE TABLE "ordr_score_renders" (
    "score_id" TEXT NOT NULL,
    "render_id" INTEGER NOT NULL,
    "video_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ordr_score_renders_pkey" PRIMARY KEY ("score_id")
);

-- CreateIndex
CREATE INDEX "ordr_score_renders_created_at_idx" ON "ordr_score_renders"("created_at");
