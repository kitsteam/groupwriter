#!/bin/sh

echo "Creating the schema..."
pnpm exec prisma migrate deploy --config dist/prisma.config.ts

echo "Starting the application..."
exec pnpm run start:prod
