-- CreateTable
CREATE TABLE "osu_to_twitch" (
    "osu_id" INTEGER NOT NULL,
    "twitch_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "osu_to_twitch_pkey" PRIMARY KEY ("osu_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "osu_to_twitch_twitch_id_key" ON "osu_to_twitch"("twitch_id");
