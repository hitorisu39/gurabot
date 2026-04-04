import "dotenv/config";
import { defineConfig } from "prisma/config";

const { DATABASE_HOST, DATABASE_USERNAME, DATABASE_PASSWORD, DATABASE_PORT, DATABASE_NAME } = process.env;

export default defineConfig({
    schema: "prisma/",
    migrations: {
        path: "prisma/migrations",
    },
    datasource: {
        url: `postgresql://${DATABASE_USERNAME}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}`,
    },
});
