#!/bin/sh
set -e

echo "⏳ Running Prisma migrations..."
npx prisma migrate deploy

echo "✅ Migrations complete. Starting the bot..."
yarn start:prod