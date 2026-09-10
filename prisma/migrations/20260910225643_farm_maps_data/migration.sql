-- CreateTable
CREATE TABLE "farm_datasets" (
    "mode" INTEGER NOT NULL,
    "snapshot_id" INTEGER NOT NULL,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farm_datasets_pkey" PRIMARY KEY ("mode")
);

-- CreateTable
CREATE TABLE "farm_snapshots" (
    "id" SERIAL NOT NULL,
    "mode" INTEGER NOT NULL,
    "source_updated_at" TIMESTAMP(3) NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mapset_count" INTEGER NOT NULL DEFAULT 0,
    "map_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "farm_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farm_mapsets" (
    "snapshot_id" INTEGER NOT NULL,
    "mapset_id" INTEGER NOT NULL,
    "artist" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bpm" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "farm_mapsets_pkey" PRIMARY KEY ("snapshot_id","mapset_id")
);

-- CreateTable
CREATE TABLE "farm_maps" (
    "snapshot_id" INTEGER NOT NULL,
    "beatmap_id" INTEGER NOT NULL,
    "mapset_id" INTEGER NOT NULL,
    "mods" INTEGER NOT NULL,
    "farm_value" DOUBLE PRECISION NOT NULL,
    "farmability" DOUBLE PRECISION NOT NULL,
    "pp" DOUBLE PRECISION,
    "adjusted" DOUBLE PRECISION NOT NULL,
    "version" TEXT NOT NULL,
    "length" INTEGER NOT NULL,
    "effective_length" DOUBLE PRECISION NOT NULL,
    "effective_bpm" DOUBLE PRECISION NOT NULL,
    "stars" DOUBLE PRECISION NOT NULL,
    "pass_count" INTEGER NOT NULL,
    "age_hours" DOUBLE PRECISION NOT NULL,
    "ranked_at" TIMESTAMP(3) NOT NULL,
    "ar" DOUBLE PRECISION NOT NULL,
    "effective_ar" DOUBLE PRECISION NOT NULL,
    "cs" DOUBLE PRECISION NOT NULL,
    "od" DOUBLE PRECISION NOT NULL,
    "hp" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "farm_maps_pkey" PRIMARY KEY ("snapshot_id","beatmap_id","mods")
);

-- CreateIndex
CREATE UNIQUE INDEX "farm_datasets_snapshot_id_key" ON "farm_datasets"("snapshot_id");

-- CreateIndex
CREATE INDEX "farm_snapshots_mode_imported_at_idx" ON "farm_snapshots"("mode", "imported_at");

-- CreateIndex
CREATE INDEX "farm_maps_snapshot_id_farmability_idx" ON "farm_maps"("snapshot_id", "farmability");

-- CreateIndex
CREATE INDEX "farm_maps_snapshot_id_pp_idx" ON "farm_maps"("snapshot_id", "pp");

-- CreateIndex
CREATE INDEX "farm_maps_snapshot_id_stars_idx" ON "farm_maps"("snapshot_id", "stars");

-- CreateIndex
CREATE INDEX "farm_maps_snapshot_id_effective_bpm_idx" ON "farm_maps"("snapshot_id", "effective_bpm");

-- CreateIndex
CREATE INDEX "farm_maps_snapshot_id_effective_length_idx" ON "farm_maps"("snapshot_id", "effective_length");

-- CreateIndex
CREATE INDEX "farm_maps_snapshot_id_ranked_at_idx" ON "farm_maps"("snapshot_id", "ranked_at");

-- CreateIndex
CREATE INDEX "farm_maps_snapshot_id_mods_farmability_idx" ON "farm_maps"("snapshot_id", "mods", "farmability");

-- AddForeignKey
ALTER TABLE "farm_datasets" ADD CONSTRAINT "farm_datasets_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "farm_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_mapsets" ADD CONSTRAINT "farm_mapsets_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "farm_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_maps" ADD CONSTRAINT "farm_maps_snapshot_id_mapset_id_fkey" FOREIGN KEY ("snapshot_id", "mapset_id") REFERENCES "farm_mapsets"("snapshot_id", "mapset_id") ON DELETE CASCADE ON UPDATE CASCADE;
