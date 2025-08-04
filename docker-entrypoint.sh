#!/bin/sh
set -e

echo "Starting Docker entrypoint..."

# Run migrations if POSTGRES_URL is set
if [ -n "$POSTGRES_URL" ]; then
  echo "Running database migrations..."
  node migrate.js
else
  echo "No POSTGRES_URL set, skipping migrations"
fi

echo "Starting application..."
exec "$@"