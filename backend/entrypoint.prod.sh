#!/bin/sh
echo "rollback failed migration"
npx prisma migrate resolve --config dist/prisma.config.ts --rolled-back "20251123150223_add_owner_external_id"

echo "Creating the schema..."
npx prisma migrate deploy --config dist/prisma.config.ts

echo "Starting the application..."
npm run start:prod