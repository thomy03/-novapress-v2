#!/usr/bin/env bash
# =============================================================================
# NovaPress AI v2 - PostgreSQL Restore Script
# =============================================================================
# Restores a PostgreSQL database from a gzipped pg_dump backup.
#
# Usage:
#   ./scripts/restore-db.sh /backups/postgresql/novapress_backup_20260222_030000.sql.gz
#   ./scripts/restore-db.sh --force /backups/postgresql/novapress_backup_20260222_030000.sql.gz
#   ./scripts/restore-db.sh --inside-docker /backups/postgresql/novapress_backup_20260222_030000.sql.gz
#   ./scripts/restore-db.sh --list            # List available backups
#
# Environment variable overrides:
#   DB_HOST       (default: localhost)
#   DB_PORT       (default: 5432)
#   DB_NAME       (default: novapress_db)
#   DB_USER       (default: novapress)
#   DB_PASSWORD   (default: password)
#   DOCKER_CONTAINER (default: novapress_postgres)
#
# Flags:
#   --force          Skip confirmation prompt
#   --inside-docker  Run inside Docker container (direct psql access)
#   --list           List available backups and exit
#
# Exit codes:
#   0 - Success
#   1 - Failure
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-novapress_db}"
DB_USER="${DB_USER:-novapress}"
DB_PASSWORD="${DB_PASSWORD:-password}"
BACKUP_DIR="${BACKUP_DIR:-/backups/postgresql}"
DOCKER_CONTAINER="${DOCKER_CONTAINER:-novapress_postgres}"

FORCE=false
INSIDE_DOCKER=false
LIST_MODE=false
BACKUP_FILE=""

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --force)
            FORCE=true
            shift
            ;;
        --inside-docker)
            INSIDE_DOCKER=true
            shift
            ;;
        --list)
            LIST_MODE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--force] [--inside-docker] [--list] <backup_file.sql.gz>"
            echo ""
            echo "Flags:"
            echo "  --force          Skip confirmation prompt"
            echo "  --inside-docker  Run inside Docker container"
            echo "  --list           List available backups"
            echo ""
            echo "Environment variables:"
            echo "  DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DOCKER_CONTAINER"
            exit 0
            ;;
        *)
            BACKUP_FILE="$1"
            shift
            ;;
    esac
done

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
log_info()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]  $*"; }
log_warn()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARN]  $*"; }
log_error() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $*" >&2; }

# ---------------------------------------------------------------------------
# List mode
# ---------------------------------------------------------------------------
if ${LIST_MODE}; then
    echo "=========================================="
    echo "Available NovaPress Backups"
    echo "=========================================="
    if [[ -d "${BACKUP_DIR}" ]]; then
        found=0
        while IFS= read -r f; do
            fname="$(basename "$f")"
            fsize="$(stat -c%s "$f" 2>/dev/null || stat -f%z "$f" 2>/dev/null || echo '?')"
            if [[ "${fsize}" != "?" && "${fsize}" -ge 1048576 ]]; then
                fsize_h="$(echo "scale=2; ${fsize}/1048576" | bc 2>/dev/null || echo "${fsize}")MB"
            elif [[ "${fsize}" != "?" && "${fsize}" -ge 1024 ]]; then
                fsize_h="$(echo "scale=2; ${fsize}/1024" | bc 2>/dev/null || echo "${fsize}")KB"
            else
                fsize_h="${fsize}B"
            fi
            echo "  ${fname}  (${fsize_h})"
            (( found++ )) || true
        done < <(find "${BACKUP_DIR}" -maxdepth 1 -name "novapress_backup_*.sql.gz" -type f | sort -r)

        if [[ ${found} -eq 0 ]]; then
            echo "  (no backups found in ${BACKUP_DIR})"
        else
            echo ""
            echo "Total: ${found} backup(s)"
        fi
    else
        echo "  Backup directory not found: ${BACKUP_DIR}"
    fi
    echo "=========================================="
    exit 0
fi

# ---------------------------------------------------------------------------
# Validate backup file
# ---------------------------------------------------------------------------
if [[ -z "${BACKUP_FILE}" ]]; then
    log_error "No backup file specified"
    echo "Usage: $0 [--force] [--inside-docker] <backup_file.sql.gz>"
    echo "       $0 --list"
    exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
    log_error "Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

BACKUP_SIZE="$(stat -c%s "${BACKUP_FILE}" 2>/dev/null || stat -f%z "${BACKUP_FILE}" 2>/dev/null || echo 0)"

if [[ "${BACKUP_SIZE}" -le 0 ]]; then
    log_error "Backup file is empty: ${BACKUP_FILE}"
    exit 1
fi

log_info "=========================================="
log_info "NovaPress PostgreSQL Restore"
log_info "=========================================="
log_info "Backup file: ${BACKUP_FILE}"
log_info "File size:   ${BACKUP_SIZE} bytes"
log_info "Target DB:   ${DB_NAME}@${DB_HOST}:${DB_PORT}"

# ---------------------------------------------------------------------------
# Confirmation prompt
# ---------------------------------------------------------------------------
if ! ${FORCE}; then
    echo ""
    echo "  WARNING: This will DROP and RECREATE the database '${DB_NAME}'."
    echo "  ALL EXISTING DATA WILL BE PERMANENTLY DELETED."
    echo ""
    read -rp "  Are you sure you want to continue? (type 'yes' to confirm): " confirm
    echo ""
    if [[ "${confirm}" != "yes" ]]; then
        log_info "Restore cancelled by user"
        exit 0
    fi
fi

# ---------------------------------------------------------------------------
# Helper: run psql command
# ---------------------------------------------------------------------------
run_psql() {
    local db="$1"
    shift
    if ${INSIDE_DOCKER}; then
        export PGPASSWORD="${DB_PASSWORD}"
        psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${db}" "$@"
    else
        docker exec -i \
            -e PGPASSWORD="${DB_PASSWORD}" \
            "${DOCKER_CONTAINER}" \
            psql -h localhost -p 5432 -U "${DB_USER}" -d "${db}" "$@"
    fi
}

# ---------------------------------------------------------------------------
# Step 1: Drop and recreate database
# ---------------------------------------------------------------------------
log_info "Step 1/4: Terminating active connections..."

run_psql "postgres" -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" \
    >/dev/null 2>&1 || true

log_info "Step 2/4: Dropping and recreating database '${DB_NAME}'..."

run_psql "postgres" -c "DROP DATABASE IF EXISTS ${DB_NAME};" 2>/dev/null
run_psql "postgres" -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null

log_info "Database '${DB_NAME}' recreated successfully"

# ---------------------------------------------------------------------------
# Step 2: Restore from backup
# ---------------------------------------------------------------------------
log_info "Step 3/4: Restoring from backup..."

RESTORE_START="$(date +%s)"

if ${INSIDE_DOCKER}; then
    export PGPASSWORD="${DB_PASSWORD}"
    gunzip -c "${BACKUP_FILE}" | psql \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        --quiet \
        --single-transaction \
        2>/dev/null
else
    gunzip -c "${BACKUP_FILE}" | docker exec -i \
        -e PGPASSWORD="${DB_PASSWORD}" \
        "${DOCKER_CONTAINER}" \
        psql \
            -h localhost \
            -p 5432 \
            -U "${DB_USER}" \
            -d "${DB_NAME}" \
            --quiet \
            --single-transaction \
        2>/dev/null
fi

RESTORE_END="$(date +%s)"
RESTORE_DURATION=$(( RESTORE_END - RESTORE_START ))

log_info "Restore completed in ${RESTORE_DURATION}s"

# ---------------------------------------------------------------------------
# Step 3: Verify restore
# ---------------------------------------------------------------------------
log_info "Step 4/4: Verifying restore..."

TABLE_COUNT_QUERY="SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"

if ${INSIDE_DOCKER}; then
    export PGPASSWORD="${DB_PASSWORD}"
    TABLE_COUNT="$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -A -c "${TABLE_COUNT_QUERY}" 2>/dev/null)"
else
    TABLE_COUNT="$(docker exec -i \
        -e PGPASSWORD="${DB_PASSWORD}" \
        "${DOCKER_CONTAINER}" \
        psql -h localhost -p 5432 -U "${DB_USER}" -d "${DB_NAME}" -t -A -c "${TABLE_COUNT_QUERY}" 2>/dev/null)"
fi

TABLE_COUNT="${TABLE_COUNT:-0}"
TABLE_COUNT="$(echo "${TABLE_COUNT}" | tr -d '[:space:]')"

if [[ "${TABLE_COUNT}" -le 0 ]]; then
    log_error "Verification failed: no tables found after restore"
    exit 1
fi

# Get table names for reporting
TABLE_NAMES_QUERY="SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;"

log_info "Verification passed: ${TABLE_COUNT} table(s) restored"

if ${INSIDE_DOCKER}; then
    export PGPASSWORD="${DB_PASSWORD}"
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -A -c "${TABLE_NAMES_QUERY}" 2>/dev/null | while IFS= read -r tbl; do
        [[ -n "${tbl}" ]] && log_info "  - ${tbl}"
    done
else
    docker exec -i \
        -e PGPASSWORD="${DB_PASSWORD}" \
        "${DOCKER_CONTAINER}" \
        psql -h localhost -p 5432 -U "${DB_USER}" -d "${DB_NAME}" -t -A -c "${TABLE_NAMES_QUERY}" 2>/dev/null | while IFS= read -r tbl; do
        [[ -n "${tbl}" ]] && log_info "  - ${tbl}"
    done
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
log_info "=========================================="
log_info "NovaPress PostgreSQL Restore - COMPLETE"
log_info "=========================================="
log_info "Source:   $(basename "${BACKUP_FILE}")"
log_info "Database: ${DB_NAME}"
log_info "Tables:   ${TABLE_COUNT}"
log_info "Duration: ${RESTORE_DURATION}s"
log_info "=========================================="

exit 0
