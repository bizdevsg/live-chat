#!/usr/bin/env bash
# Restores a SolidChat MySQL dump produced by backup-mysql.sh.
# Usage: ./infrastructure/scripts/restore-mysql.sh ./backups/solidchat-20260101-000000.sql.gz
set -euo pipefail

DUMP_FILE="${1:?Usage: restore-mysql.sh <path-to-dump.sql.gz>}"

: "${MYSQL_DATABASE:?Set MYSQL_DATABASE (see .env)}"
: "${MYSQL_USER:?Set MYSQL_USER (see .env)}"
: "${MYSQL_PASSWORD:?Set MYSQL_PASSWORD (see .env)}"

echo "This will overwrite the current contents of database '${MYSQL_DATABASE}'. Ctrl+C to abort."
sleep 5

gunzip -c "${DUMP_FILE}" | docker compose exec -T mysql \
  mysql -u "${MYSQL_USER}" -p"${MYSQL_PASSWORD}" "${MYSQL_DATABASE}"

echo "Restore complete."
