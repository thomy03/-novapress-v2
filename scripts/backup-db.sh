#!/usr/bin/env bash
# =============================================================================
# NovaPress AI v2 - PostgreSQL Backup Script
# =============================================================================
# Creates timestamped, compressed pg_dump backups with retention policy.
#
# Usage:
#   ./scripts/backup-db.sh                  # Run from host (docker exec)
#   ./scripts/backup-db.sh --inside-docker  # Run inside Docker container
#
# Environment variable overrides:
#   DB_HOST       (default: localhost)
#   DB_PORT       (default: 5432)
#   DB_NAME       (default: novapress_db)
#   DB_USER       (default: novapress)
#   DB_PASSWORD   (default: password)
#   BACKUP_DIR    (default: /backups/postgresql)
#   LOG_FILE      (default: /var/log/novapress/backup.log)
#   DOCKER_CONTAINER (default: novapress_postgres)
#   AWS_S3_BUCKET (optional: enable S3 upload)
#   AWS_S3_PREFIX (optional: S3 key prefix, default: novapress/postgresql)
#
# Retention policy:
#   - 7 daily backups
#   - 4 weekly backups (Sunday)
#   - 3 monthly backups (1st of month)
#
# Exit codes:
#   0 - Success
#   1 - Failure
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration (with environment variable overrides)
# ---------------------------------------------------------------------------
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-novapress_db}"
DB_USER="${DB_USER:-novapress}"
DB_PASSWORD="${DB_PASSWORD:-password}"
BACKUP_DIR="${BACKUP_DIR:-/backups/postgresql}"
LOG_FILE="${LOG_FILE:-/var/log/novapress/backup.log}"
DOCKER_CONTAINER="${DOCKER_CONTAINER:-novapress_postgres}"
AWS_S3_PREFIX="${AWS_S3_PREFIX:-novapress/postgresql}"

# Detect execution mode
INSIDE_DOCKER=false
if [[ "${1:-}" == "--inside-docker" ]]; then
    INSIDE_DOCKER=true
fi

# Timestamp for backup filename
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DATE_ONLY="$(date +%Y%m%d)"
DAY_OF_WEEK="$(date +%u)"   # 1=Monday, 7=Sunday
DAY_OF_MONTH="$(date +%d)"  # 01-31

BACKUP_FILENAME="novapress_backup_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

# Retention settings
DAILY_RETENTION=7
WEEKLY_RETENTION=4
MONTHLY_RETENTION=3

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp
    timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
    local log_line="[${timestamp}] [${level}] ${message}"

    echo "${log_line}"

    # Write to log file if directory exists or can be created
    local log_dir
    log_dir="$(dirname "${LOG_FILE}")"
    if mkdir -p "${log_dir}" 2>/dev/null; then
        echo "${log_line}" >> "${LOG_FILE}" 2>/dev/null || true
    fi
}

log_info()  { log "INFO"  "$@"; }
log_warn()  { log "WARN"  "$@"; }
log_error() { log "ERROR" "$@"; }

# ---------------------------------------------------------------------------
# Cleanup on failure
# ---------------------------------------------------------------------------
cleanup() {
    local exit_code=$?
    if [[ ${exit_code} -ne 0 ]]; then
        log_error "Backup failed with exit code ${exit_code}"
        # Remove partial backup file if it exists
        if [[ -f "${BACKUP_PATH}" ]]; then
            rm -f "${BACKUP_PATH}"
            log_warn "Removed partial backup file: ${BACKUP_PATH}"
        fi
    fi
    exit "${exit_code}"
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Create backup directory
# ---------------------------------------------------------------------------
mkdir -p "${BACKUP_DIR}"
if [[ ! -d "${BACKUP_DIR}" ]]; then
    log_error "Cannot create backup directory: ${BACKUP_DIR}"
    exit 1
fi

log_info "=========================================="
log_info "NovaPress PostgreSQL Backup - START"
log_info "=========================================="
log_info "Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}"
log_info "Backup target: ${BACKUP_PATH}"
log_info "Mode: $(if ${INSIDE_DOCKER}; then echo 'inside-docker'; else echo 'host (docker exec)'; fi)"

# ---------------------------------------------------------------------------
# Health check: verify PostgreSQL is ready
# ---------------------------------------------------------------------------
log_info "Running health check..."

if ${INSIDE_DOCKER}; then
    # Running inside Docker -- connect directly
    export PGPASSWORD="${DB_PASSWORD}"
    if ! pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t 10 >/dev/null 2>&1; then
        log_error "PostgreSQL is not ready at ${DB_HOST}:${DB_PORT}"
        exit 1
    fi
else
    # Running from host -- use docker exec
    if ! docker exec "${DOCKER_CONTAINER}" pg_isready -U "${DB_USER}" -d "${DB_NAME}" -t 10 >/dev/null 2>&1; then
        log_error "PostgreSQL container '${DOCKER_CONTAINER}' is not ready or not running"
        exit 1
    fi
fi

log_info "Health check passed - PostgreSQL is ready"

# ---------------------------------------------------------------------------
# Create backup
# ---------------------------------------------------------------------------
log_info "Starting pg_dump..."

DUMP_START="$(date +%s)"

if ${INSIDE_DOCKER}; then
    # Running inside Docker
    export PGPASSWORD="${DB_PASSWORD}"
    pg_dump \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        --format=plain \
        --no-owner \
        --no-privileges \
        --verbose 2>/dev/null \
    | gzip -9 > "${BACKUP_PATH}"
else
    # Running from host via docker exec
    docker exec \
        -e PGPASSWORD="${DB_PASSWORD}" \
        "${DOCKER_CONTAINER}" \
        pg_dump \
            -h localhost \
            -p 5432 \
            -U "${DB_USER}" \
            -d "${DB_NAME}" \
            --format=plain \
            --no-owner \
            --no-privileges \
    | gzip -9 > "${BACKUP_PATH}"
fi

DUMP_END="$(date +%s)"
DUMP_DURATION=$(( DUMP_END - DUMP_START ))

log_info "pg_dump completed in ${DUMP_DURATION}s"

# ---------------------------------------------------------------------------
# Integrity check: verify backup file size > 0
# ---------------------------------------------------------------------------
if [[ ! -f "${BACKUP_PATH}" ]]; then
    log_error "Backup file was not created: ${BACKUP_PATH}"
    exit 1
fi

BACKUP_SIZE="$(stat -c%s "${BACKUP_PATH}" 2>/dev/null || stat -f%z "${BACKUP_PATH}" 2>/dev/null || echo 0)"

if [[ "${BACKUP_SIZE}" -le 0 ]]; then
    log_error "Backup file is empty (0 bytes): ${BACKUP_PATH}"
    rm -f "${BACKUP_PATH}"
    exit 1
fi

# Convert to human-readable size
if [[ "${BACKUP_SIZE}" -ge 1048576 ]]; then
    HUMAN_SIZE="$(echo "scale=2; ${BACKUP_SIZE}/1048576" | bc 2>/dev/null || echo "${BACKUP_SIZE}")MB"
elif [[ "${BACKUP_SIZE}" -ge 1024 ]]; then
    HUMAN_SIZE="$(echo "scale=2; ${BACKUP_SIZE}/1024" | bc 2>/dev/null || echo "${BACKUP_SIZE}")KB"
else
    HUMAN_SIZE="${BACKUP_SIZE}B"
fi

log_info "Backup file verified: ${BACKUP_FILENAME} (${HUMAN_SIZE})"

# ---------------------------------------------------------------------------
# Optional: S3 upload
# ---------------------------------------------------------------------------
if [[ -n "${AWS_S3_BUCKET:-}" ]]; then
    log_info "Uploading to S3: s3://${AWS_S3_BUCKET}/${AWS_S3_PREFIX}/${BACKUP_FILENAME}"

    if command -v aws >/dev/null 2>&1; then
        if aws s3 cp "${BACKUP_PATH}" "s3://${AWS_S3_BUCKET}/${AWS_S3_PREFIX}/${BACKUP_FILENAME}" \
            --storage-class STANDARD_IA \
            --only-show-errors; then
            log_info "S3 upload successful"
        else
            log_warn "S3 upload failed - local backup is still available"
        fi
    else
        log_warn "AWS CLI not installed - skipping S3 upload"
    fi
fi

# ---------------------------------------------------------------------------
# Retention policy
# ---------------------------------------------------------------------------
log_info "Applying retention policy..."

# Collect all backup files sorted by date (oldest first)
mapfile -t ALL_BACKUPS < <(
    find "${BACKUP_DIR}" -maxdepth 1 -name "novapress_backup_*.sql.gz" -type f | sort
)

TOTAL_BACKUPS="${#ALL_BACKUPS[@]}"
log_info "Total backups found: ${TOTAL_BACKUPS}"

# Classify backups into daily, weekly, monthly
declare -A KEEP_FILES

for backup_file in "${ALL_BACKUPS[@]}"; do
    fname="$(basename "${backup_file}")"
    # Extract date from filename: novapress_backup_YYYYMMDD_HHMMSS.sql.gz
    file_date="${fname#novapress_backup_}"
    file_date="${file_date%%_*}"  # YYYYMMDD

    if [[ "${#file_date}" -ne 8 ]]; then
        continue
    fi

    # Parse date components
    file_year="${file_date:0:4}"
    file_month="${file_date:4:2}"
    file_day="${file_date:6:2}"

    # Check if monthly backup (1st of month)
    if [[ "${file_day}" == "01" ]]; then
        KEEP_FILES["${backup_file}"]="monthly"
    fi

    # Check if weekly backup (Sunday)
    # Use date command to determine day of week
    if date -d "${file_year}-${file_month}-${file_day}" +%u 2>/dev/null | grep -q "^7$"; then
        KEEP_FILES["${backup_file}"]="weekly"
    elif [[ "$(date -j -f '%Y%m%d' "${file_date}" +%u 2>/dev/null || echo '')" == "7" ]]; then
        # macOS fallback
        KEEP_FILES["${backup_file}"]="weekly"
    fi
done

# Now enforce retention counts
# Get monthly backups (1st of month) -- keep last N
mapfile -t MONTHLY_BACKUPS < <(
    for f in "${ALL_BACKUPS[@]}"; do
        fname="$(basename "$f")"
        file_date="${fname#novapress_backup_}"
        file_date="${file_date%%_*}"
        if [[ "${#file_date}" -eq 8 && "${file_date:6:2}" == "01" ]]; then
            echo "$f"
        fi
    done | sort -r
)

# Get weekly backups (Sunday) -- keep last N
mapfile -t WEEKLY_BACKUPS < <(
    for f in "${ALL_BACKUPS[@]}"; do
        fname="$(basename "$f")"
        file_date="${fname#novapress_backup_}"
        file_date="${file_date%%_*}"
        if [[ "${#file_date}" -eq 8 ]]; then
            file_year="${file_date:0:4}"
            file_month="${file_date:4:2}"
            file_day="${file_date:6:2}"
            dow="$(date -d "${file_year}-${file_month}-${file_day}" +%u 2>/dev/null || date -j -f '%Y%m%d' "${file_date}" +%u 2>/dev/null || echo '')"
            if [[ "${dow}" == "7" ]]; then
                echo "$f"
            fi
        fi
    done | sort -r
)

# All backups sorted newest first = daily candidates
mapfile -t DAILY_BACKUPS < <(printf '%s\n' "${ALL_BACKUPS[@]}" | sort -r)

# Build the set of files to keep
declare -A FILES_TO_KEEP

# Keep last N daily
count=0
for f in "${DAILY_BACKUPS[@]}"; do
    if [[ ${count} -lt ${DAILY_RETENTION} ]]; then
        FILES_TO_KEEP["${f}"]=1
        (( count++ )) || true
    fi
done

# Keep last N weekly
count=0
for f in "${WEEKLY_BACKUPS[@]}"; do
    if [[ ${count} -lt ${WEEKLY_RETENTION} ]]; then
        FILES_TO_KEEP["${f}"]=1
        (( count++ )) || true
    fi
done

# Keep last N monthly
count=0
for f in "${MONTHLY_BACKUPS[@]}"; do
    if [[ ${count} -lt ${MONTHLY_RETENTION} ]]; then
        FILES_TO_KEEP["${f}"]=1
        (( count++ )) || true
    fi
done

# Always keep the backup we just created
FILES_TO_KEEP["${BACKUP_PATH}"]=1

# Delete files not in keep set
DELETED_COUNT=0
for f in "${ALL_BACKUPS[@]}"; do
    if [[ -z "${FILES_TO_KEEP[${f}]:-}" ]]; then
        rm -f "${f}"
        log_info "Deleted old backup: $(basename "${f}")"
        (( DELETED_COUNT++ )) || true
    fi
done

# Count remaining backups
REMAINING="$(find "${BACKUP_DIR}" -maxdepth 1 -name "novapress_backup_*.sql.gz" -type f | wc -l)"

log_info "Retention: deleted ${DELETED_COUNT} old backups, ${REMAINING} remaining"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
log_info "=========================================="
log_info "NovaPress PostgreSQL Backup - COMPLETE"
log_info "=========================================="
log_info "File:     ${BACKUP_FILENAME}"
log_info "Size:     ${HUMAN_SIZE}"
log_info "Duration: ${DUMP_DURATION}s"
log_info "Backups:  ${REMAINING} total on disk"
log_info "=========================================="

exit 0
