#!/usr/bin/env bash
# =============================================================================
# NovaPress AI v2 - Qdrant Vector Database Backup Script
# =============================================================================
# Creates snapshots of the Qdrant vector database using the snapshot API.
#
# Usage:
#   ./scripts/backup-qdrant.sh
#
# Environment variable overrides:
#   QDRANT_URL        (default: http://localhost:6333)
#   QDRANT_COLLECTION (default: novapress_articles)
#   BACKUP_DIR        (default: /backups/qdrant)
#   LOG_FILE          (default: /var/log/novapress/backup.log)
#   AWS_S3_BUCKET     (optional: enable S3 upload)
#   AWS_S3_PREFIX     (optional: S3 key prefix, default: novapress/qdrant)
#
# Retention policy (same as PostgreSQL):
#   - 7 daily snapshots
#   - 4 weekly snapshots (Sunday)
#   - 3 monthly snapshots (1st of month)
#
# Exit codes:
#   0 - Success
#   1 - Failure
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
QDRANT_URL="${QDRANT_URL:-http://localhost:6333}"
QDRANT_COLLECTION="${QDRANT_COLLECTION:-novapress_articles}"
BACKUP_DIR="${BACKUP_DIR:-/backups/qdrant}"
LOG_FILE="${LOG_FILE:-/var/log/novapress/backup.log}"
AWS_S3_PREFIX="${AWS_S3_PREFIX:-novapress/qdrant}"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DATE_ONLY="$(date +%Y%m%d)"
DAY_OF_WEEK="$(date +%u)"   # 1=Monday, 7=Sunday
DAY_OF_MONTH="$(date +%d)"  # 01-31

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
    local log_line="[${timestamp}] [${level}] [qdrant] ${message}"

    echo "${log_line}"

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
        log_error "Qdrant backup failed with exit code ${exit_code}"
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
log_info "NovaPress Qdrant Backup - START"
log_info "=========================================="
log_info "Qdrant URL:   ${QDRANT_URL}"
log_info "Collection:   ${QDRANT_COLLECTION}"
log_info "Backup dir:   ${BACKUP_DIR}"

# ---------------------------------------------------------------------------
# Health check: verify Qdrant is reachable
# ---------------------------------------------------------------------------
log_info "Running health check..."

if ! curl -sf "${QDRANT_URL}/healthz" >/dev/null 2>&1; then
    # Fallback: try the collections endpoint
    if ! curl -sf "${QDRANT_URL}/collections" >/dev/null 2>&1; then
        log_error "Qdrant is not reachable at ${QDRANT_URL}"
        exit 1
    fi
fi

log_info "Health check passed - Qdrant is reachable"

# ---------------------------------------------------------------------------
# Verify collection exists
# ---------------------------------------------------------------------------
log_info "Checking collection '${QDRANT_COLLECTION}'..."

COLLECTION_STATUS="$(curl -sf "${QDRANT_URL}/collections/${QDRANT_COLLECTION}" 2>/dev/null || echo '{"status":"error"}')"

if echo "${COLLECTION_STATUS}" | grep -q '"status":"error"'; then
    log_error "Collection '${QDRANT_COLLECTION}' not found or inaccessible"
    exit 1
fi

# Extract point count if available
POINT_COUNT="$(echo "${COLLECTION_STATUS}" | grep -o '"points_count":[0-9]*' | grep -o '[0-9]*' || echo 'unknown')"
log_info "Collection '${QDRANT_COLLECTION}' found (${POINT_COUNT} points)"

# ---------------------------------------------------------------------------
# Create snapshot via Qdrant API
# ---------------------------------------------------------------------------
log_info "Creating snapshot..."

SNAP_START="$(date +%s)"

SNAPSHOT_RESPONSE="$(curl -sf -X POST \
    "${QDRANT_URL}/collections/${QDRANT_COLLECTION}/snapshots" \
    -H "Content-Type: application/json" \
    2>/dev/null || echo '{"status":"error"}')"

if echo "${SNAPSHOT_RESPONSE}" | grep -q '"status":"error"'; then
    log_error "Failed to create snapshot"
    log_error "Response: ${SNAPSHOT_RESPONSE}"
    exit 1
fi

# Extract snapshot name from response
# Response format: {"result":{"name":"...","creation_time":"...","size":...}}
SNAPSHOT_NAME="$(echo "${SNAPSHOT_RESPONSE}" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)"

if [[ -z "${SNAPSHOT_NAME}" ]]; then
    log_error "Could not extract snapshot name from response"
    log_error "Response: ${SNAPSHOT_RESPONSE}"
    exit 1
fi

log_info "Snapshot created: ${SNAPSHOT_NAME}"

# ---------------------------------------------------------------------------
# Download snapshot
# ---------------------------------------------------------------------------
LOCAL_FILENAME="qdrant_${QDRANT_COLLECTION}_${TIMESTAMP}.snapshot"
LOCAL_PATH="${BACKUP_DIR}/${LOCAL_FILENAME}"

log_info "Downloading snapshot to ${LOCAL_PATH}..."

HTTP_CODE="$(curl -sf -o "${LOCAL_PATH}" -w "%{http_code}" \
    "${QDRANT_URL}/collections/${QDRANT_COLLECTION}/snapshots/${SNAPSHOT_NAME}" \
    2>/dev/null || echo '000')"

if [[ "${HTTP_CODE}" != "200" ]]; then
    log_error "Failed to download snapshot (HTTP ${HTTP_CODE})"
    rm -f "${LOCAL_PATH}"
    exit 1
fi

SNAP_END="$(date +%s)"
SNAP_DURATION=$(( SNAP_END - SNAP_START ))

# ---------------------------------------------------------------------------
# Verify downloaded file
# ---------------------------------------------------------------------------
if [[ ! -f "${LOCAL_PATH}" ]]; then
    log_error "Downloaded snapshot file not found: ${LOCAL_PATH}"
    exit 1
fi

SNAP_SIZE="$(stat -c%s "${LOCAL_PATH}" 2>/dev/null || stat -f%z "${LOCAL_PATH}" 2>/dev/null || echo 0)"

if [[ "${SNAP_SIZE}" -le 0 ]]; then
    log_error "Downloaded snapshot is empty: ${LOCAL_PATH}"
    rm -f "${LOCAL_PATH}"
    exit 1
fi

# Human-readable size
if [[ "${SNAP_SIZE}" -ge 1048576 ]]; then
    HUMAN_SIZE="$(echo "scale=2; ${SNAP_SIZE}/1048576" | bc 2>/dev/null || echo "${SNAP_SIZE}")MB"
elif [[ "${SNAP_SIZE}" -ge 1024 ]]; then
    HUMAN_SIZE="$(echo "scale=2; ${SNAP_SIZE}/1024" | bc 2>/dev/null || echo "${SNAP_SIZE}")KB"
else
    HUMAN_SIZE="${SNAP_SIZE}B"
fi

log_info "Snapshot downloaded: ${LOCAL_FILENAME} (${HUMAN_SIZE})"

# ---------------------------------------------------------------------------
# Delete remote snapshot (cleanup Qdrant storage)
# ---------------------------------------------------------------------------
log_info "Cleaning up remote snapshot..."

curl -sf -X DELETE \
    "${QDRANT_URL}/collections/${QDRANT_COLLECTION}/snapshots/${SNAPSHOT_NAME}" \
    >/dev/null 2>&1 || log_warn "Could not delete remote snapshot (non-critical)"

# ---------------------------------------------------------------------------
# Optional: S3 upload
# ---------------------------------------------------------------------------
if [[ -n "${AWS_S3_BUCKET:-}" ]]; then
    log_info "Uploading to S3: s3://${AWS_S3_BUCKET}/${AWS_S3_PREFIX}/${LOCAL_FILENAME}"

    if command -v aws >/dev/null 2>&1; then
        if aws s3 cp "${LOCAL_PATH}" "s3://${AWS_S3_BUCKET}/${AWS_S3_PREFIX}/${LOCAL_FILENAME}" \
            --storage-class STANDARD_IA \
            --only-show-errors; then
            log_info "S3 upload successful"
        else
            log_warn "S3 upload failed - local snapshot is still available"
        fi
    else
        log_warn "AWS CLI not installed - skipping S3 upload"
    fi
fi

# ---------------------------------------------------------------------------
# Retention policy
# ---------------------------------------------------------------------------
log_info "Applying retention policy..."

PATTERN="qdrant_${QDRANT_COLLECTION}_*.snapshot"

mapfile -t ALL_SNAPSHOTS < <(
    find "${BACKUP_DIR}" -maxdepth 1 -name "${PATTERN}" -type f | sort
)

TOTAL_SNAPSHOTS="${#ALL_SNAPSHOTS[@]}"
log_info "Total snapshots found: ${TOTAL_SNAPSHOTS}"

# Build keep set
declare -A FILES_TO_KEEP

# Extract date from filename: qdrant_novapress_articles_YYYYMMDD_HHMMSS.snapshot
get_date_from_qdrant_file() {
    local fname
    fname="$(basename "$1")"
    # Remove prefix: qdrant_<collection>_
    local date_part="${fname#qdrant_${QDRANT_COLLECTION}_}"
    # Extract YYYYMMDD
    echo "${date_part%%_*}"
}

# Monthly backups (1st of month)
mapfile -t MONTHLY_SNAPS < <(
    for f in "${ALL_SNAPSHOTS[@]}"; do
        file_date="$(get_date_from_qdrant_file "$f")"
        if [[ "${#file_date}" -eq 8 && "${file_date:6:2}" == "01" ]]; then
            echo "$f"
        fi
    done | sort -r
)

# Weekly backups (Sunday)
mapfile -t WEEKLY_SNAPS < <(
    for f in "${ALL_SNAPSHOTS[@]}"; do
        file_date="$(get_date_from_qdrant_file "$f")"
        if [[ "${#file_date}" -eq 8 ]]; then
            fy="${file_date:0:4}"
            fm="${file_date:4:2}"
            fd="${file_date:6:2}"
            dow="$(date -d "${fy}-${fm}-${fd}" +%u 2>/dev/null || date -j -f '%Y%m%d' "${file_date}" +%u 2>/dev/null || echo '')"
            if [[ "${dow}" == "7" ]]; then
                echo "$f"
            fi
        fi
    done | sort -r
)

# Daily backups (all, newest first)
mapfile -t DAILY_SNAPS < <(printf '%s\n' "${ALL_SNAPSHOTS[@]}" | sort -r)

# Keep last N daily
count=0
for f in "${DAILY_SNAPS[@]}"; do
    if [[ ${count} -lt ${DAILY_RETENTION} ]]; then
        FILES_TO_KEEP["${f}"]=1
        (( count++ )) || true
    fi
done

# Keep last N weekly
count=0
for f in "${WEEKLY_SNAPS[@]}"; do
    if [[ ${count} -lt ${WEEKLY_RETENTION} ]]; then
        FILES_TO_KEEP["${f}"]=1
        (( count++ )) || true
    fi
done

# Keep last N monthly
count=0
for f in "${MONTHLY_SNAPS[@]}"; do
    if [[ ${count} -lt ${MONTHLY_RETENTION} ]]; then
        FILES_TO_KEEP["${f}"]=1
        (( count++ )) || true
    fi
done

# Always keep current snapshot
FILES_TO_KEEP["${LOCAL_PATH}"]=1

# Delete old snapshots
DELETED_COUNT=0
for f in "${ALL_SNAPSHOTS[@]}"; do
    if [[ -z "${FILES_TO_KEEP[${f}]:-}" ]]; then
        rm -f "${f}"
        log_info "Deleted old snapshot: $(basename "${f}")"
        (( DELETED_COUNT++ )) || true
    fi
done

REMAINING="$(find "${BACKUP_DIR}" -maxdepth 1 -name "${PATTERN}" -type f | wc -l)"
log_info "Retention: deleted ${DELETED_COUNT} old snapshots, ${REMAINING} remaining"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
log_info "=========================================="
log_info "NovaPress Qdrant Backup - COMPLETE"
log_info "=========================================="
log_info "Collection: ${QDRANT_COLLECTION}"
log_info "Points:     ${POINT_COUNT}"
log_info "File:       ${LOCAL_FILENAME}"
log_info "Size:       ${HUMAN_SIZE}"
log_info "Duration:   ${SNAP_DURATION}s"
log_info "Snapshots:  ${REMAINING} total on disk"
log_info "=========================================="

exit 0
