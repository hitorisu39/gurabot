-- AlterTable
ALTER TABLE "user_to_osu" ADD CONSTRAINT "user_to_osu_pkey" PRIMARY KEY ("user_id", "server");

-- DropIndex
DROP INDEX "user_to_osu_user_id_server_key";
