#!/bin/sh

# Aborta o script se qualquer comando falhar
set -e

echo "Applying Prisma migrations..."
# Roda a migração de produção
npx prisma migrate deploy

echo "Starting the application..."
exec "$@"