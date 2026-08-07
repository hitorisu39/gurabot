/*
  Warnings:

  - The primary key for the `user_cache` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropIndex
DROP INDEX "user_cache_username_server_key";

-- AlterTable
ALTER TABLE "user_cache" DROP CONSTRAINT "user_cache_pkey",
ADD CONSTRAINT "user_cache_pkey" PRIMARY KEY ("username", "server");

-- CreateIndex
CREATE INDEX "user_cache_id_server_idx" ON "user_cache"("id", "server");
