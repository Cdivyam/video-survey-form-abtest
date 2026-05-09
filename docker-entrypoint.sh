#!/bin/sh
set -e

# Run any pending migrations before starting the server
npx prisma migrate deploy

exec npm start
