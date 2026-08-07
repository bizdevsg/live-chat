#!/usr/bin/env bash
# Dumps the SolidChat MySQL database from the running docker-compose "mysql" service.
# Usage: ./infrastructure/scripts/backup-mysql.sh [output-directory]
set -euo pipefail

OUT_DIR="${1:-./backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="${OUT_DIR}/solidchat-${TIMESTAMP}.sql.gz"

: "${MYSQL_DATABASE:?Set MYSQL_DATABASE (see .env)}"
: "${MYSQL_USER:?Set MYSQL_USER (see .env)}"
: "${MYSQL_PASSWORD:?Set MYSQL_PASSWORD (see .env)}"

mkdir -p "${OUT_DIR}"

docker compose exec -T mysql \
  mysqldump --single-transaction --routines --triggers \
  -u "${MYSQL_USER}" -p"${MYSQL_PASSWORD}" "${MYSQL_DATABASE}" \
  | gzip > "${OUT_FILE}"

echo "Backup written to ${OUT_FILE}"
