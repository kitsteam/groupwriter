#!/bin/sh

echo "Creating the schema..."
npx prisma migrate deploy --config dist/prisma.config.ts

echo "Starting the application..."
npm run start:prod