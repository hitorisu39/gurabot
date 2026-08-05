-- CreateTable
CREATE TABLE "standard_difficulty_attributes" (
    "beatmap_id" INTEGER NOT NULL,
    "mods" TEXT NOT NULL,
    "custom" BOOLEAN NOT NULL,
    "star_rating" DOUBLE PRECISION NOT NULL,
    "max_combo" INTEGER NOT NULL,
    "aim_difficulty" DOUBLE PRECISION NOT NULL,
    "aim_difficult_slider_count" DOUBLE PRECISION NOT NULL,
    "speed_difficulty" DOUBLE PRECISION NOT NULL,
    "speed_note_count" DOUBLE PRECISION NOT NULL,
    "flashlight_difficulty" DOUBLE PRECISION NOT NULL,
    "reading_difficulty" DOUBLE PRECISION,
    "reading_difficult_note_count" DOUBLE PRECISION,
    "slider_factor" DOUBLE PRECISION NOT NULL,
    "aim_top_weighted_slider_factor" DOUBLE PRECISION NOT NULL,
    "speed_top_weighted_slider_factor" DOUBLE PRECISION NOT NULL,
    "aim_difficult_strain_count" DOUBLE PRECISION NOT NULL,
    "speed_difficult_strain_count" DOUBLE PRECISION NOT NULL,
    "nested_score_per_object" DOUBLE PRECISION NOT NULL,
    "maximum_legacy_combo_score" DOUBLE PRECISION NOT NULL,
    "legacy_score_base_multiplier" DOUBLE PRECISION NOT NULL,
    "hit_circle_count" INTEGER NOT NULL,
    "slider_count" INTEGER NOT NULL,
    "spinner_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "standard_difficulty_attributes_pkey" PRIMARY KEY ("beatmap_id","mods")
);

-- CreateTable
CREATE TABLE "taiko_difficulty_attributes" (
    "beatmap_id" INTEGER NOT NULL,
    "mods" TEXT NOT NULL,
    "custom" BOOLEAN NOT NULL,
    "star_rating" DOUBLE PRECISION NOT NULL,
    "max_combo" INTEGER NOT NULL,
    "mechanical_difficulty" DOUBLE PRECISION,
    "rhythm_difficulty" DOUBLE PRECISION NOT NULL,
    "reading_difficulty" DOUBLE PRECISION NOT NULL,
    "colour_difficulty" DOUBLE PRECISION NOT NULL,
    "stamina_difficulty" DOUBLE PRECISION NOT NULL,
    "mono_stamina_factor" DOUBLE PRECISION NOT NULL,
    "consistency_factor" DOUBLE PRECISION NOT NULL,
    "stamina_top_strains" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taiko_difficulty_attributes_pkey" PRIMARY KEY ("beatmap_id","mods")
);

-- CreateTable
CREATE TABLE "catch_difficulty_attributes" (
    "beatmap_id" INTEGER NOT NULL,
    "mods" TEXT NOT NULL,
    "custom" BOOLEAN NOT NULL,
    "star_rating" DOUBLE PRECISION NOT NULL,
    "max_combo" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catch_difficulty_attributes_pkey" PRIMARY KEY ("beatmap_id","mods")
);

-- CreateTable
CREATE TABLE "mania_difficulty_attributes" (
    "beatmap_id" INTEGER NOT NULL,
    "mods" TEXT NOT NULL,
    "custom" BOOLEAN NOT NULL,
    "star_rating" DOUBLE PRECISION NOT NULL,
    "max_combo" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mania_difficulty_attributes_pkey" PRIMARY KEY ("beatmap_id","mods")
);

-- CreateTable
CREATE TABLE "channels" (
    "id" TEXT NOT NULL,
    "beatmap_id" INTEGER,
    "beatmapset_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guilds" (
    "id" TEXT NOT NULL,
    "prefix" TEXT,
    "server" TEXT,
    "mode" TEXT,
    "score_list_size" TEXT,

    CONSTRAINT "guilds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordr_configs" (
    "user_id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'Bot',
    "settings" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ordr_configs_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "ordr_renders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "render_id" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "skin" TEXT,
    "custom_skin" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ordr_renders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_cache" (
    "id" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "server" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_cache_pkey" PRIMARY KEY ("username")
);

-- CreateTable
CREATE TABLE "beatmap_owners" (
    "id" INTEGER NOT NULL,
    "username" TEXT NOT NULL,

    CONSTRAINT "beatmap_owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapset_covers" (
    "id" SERIAL NOT NULL,
    "cover" TEXT NOT NULL,
    "cover_2x" TEXT NOT NULL,
    "card" TEXT NOT NULL,
    "card_2x" TEXT NOT NULL,
    "list" TEXT NOT NULL,
    "list_2x" TEXT NOT NULL,
    "slimcover" TEXT NOT NULL,
    "slimcover_2x" TEXT NOT NULL,
    "beatmapset_id" INTEGER NOT NULL,

    CONSTRAINT "mapset_covers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beatmapsets" (
    "id" INTEGER NOT NULL,
    "anime_cover" BOOLEAN,
    "artist" TEXT NOT NULL,
    "artist_unicode" TEXT NOT NULL,
    "creator" TEXT NOT NULL,
    "favorite_count" INTEGER NOT NULL,
    "genre" TEXT,
    "language" TEXT NOT NULL,
    "nsfw" BOOLEAN NOT NULL,
    "offset" INTEGER NOT NULL,
    "playcount" INTEGER NOT NULL,
    "preview_url" TEXT NOT NULL,
    "source" TEXT,
    "spotlight" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "title_unicode" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "video" BOOLEAN NOT NULL,
    "ranked_date" TIMESTAMP(3),
    "submitted_date" TIMESTAMP(3) NOT NULL,
    "tags" TEXT NOT NULL,

    CONSTRAINT "beatmapsets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beatmaps" (
    "id" INTEGER NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "total_length" INTEGER NOT NULL,
    "hit_length" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "version" TEXT NOT NULL,
    "od" DOUBLE PRECISION NOT NULL,
    "ar" DOUBLE PRECISION NOT NULL,
    "cs" DOUBLE PRECISION NOT NULL,
    "hp" DOUBLE PRECISION NOT NULL,
    "bpm" DOUBLE PRECISION NOT NULL,
    "convert" BOOLEAN NOT NULL,
    "count_circles" INTEGER NOT NULL,
    "count_sliders" INTEGER NOT NULL,
    "count_spinners" INTEGER NOT NULL,
    "last_updated" TIMESTAMP(3) NOT NULL,
    "url" TEXT NOT NULL,
    "passcount" INTEGER NOT NULL,
    "playcount" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "ranked" INTEGER NOT NULL,
    "beatmapset_id" INTEGER NOT NULL,

    CONSTRAINT "beatmaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "server" TEXT,
    "mode" TEXT,
    "score_list_size" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_to_osu" (
    "user_id" TEXT NOT NULL,
    "server" TEXT NOT NULL,
    "osu_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "_beatmap_to_owners" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_beatmap_to_owners_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "ordr_renders_user_id_created_at_idx" ON "ordr_renders"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_cache_username_server_key" ON "user_cache"("username", "server");

-- CreateIndex
CREATE UNIQUE INDEX "mapset_covers_beatmapset_id_key" ON "mapset_covers"("beatmapset_id");

-- CreateIndex
CREATE INDEX "beatmapsets_user_id_idx" ON "beatmapsets"("user_id");

-- CreateIndex
CREATE INDEX "beatmaps_beatmapset_id_idx" ON "beatmaps"("beatmapset_id");

-- CreateIndex
CREATE INDEX "beatmaps_user_id_idx" ON "beatmaps"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_to_osu_user_id_server_key" ON "user_to_osu"("user_id", "server");

-- CreateIndex
CREATE INDEX "_beatmap_to_owners_B_index" ON "_beatmap_to_owners"("B");

-- AddForeignKey
ALTER TABLE "ordr_configs" ADD CONSTRAINT "ordr_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordr_renders" ADD CONSTRAINT "ordr_renders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapset_covers" ADD CONSTRAINT "mapset_covers_beatmapset_id_fkey" FOREIGN KEY ("beatmapset_id") REFERENCES "beatmapsets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beatmaps" ADD CONSTRAINT "beatmaps_beatmapset_id_fkey" FOREIGN KEY ("beatmapset_id") REFERENCES "beatmapsets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_to_osu" ADD CONSTRAINT "user_to_osu_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_beatmap_to_owners" ADD CONSTRAINT "_beatmap_to_owners_A_fkey" FOREIGN KEY ("A") REFERENCES "beatmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_beatmap_to_owners" ADD CONSTRAINT "_beatmap_to_owners_B_fkey" FOREIGN KEY ("B") REFERENCES "beatmap_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
