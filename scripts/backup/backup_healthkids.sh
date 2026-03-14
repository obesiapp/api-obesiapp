#!/bin/bash
# =============================================================================
#  RF-03 — Respaldo automático de PostgreSQL con verificación SHA-256
#  Archivo : /scripts/backup/backup_healthkids.sh
#  Cron    : 0 2 * * *  /bin/bash /scripts/backup/backup_healthkids.sh
#  Retención: 30 días
# =============================================================================

set -euo pipefail

# ─── Configuración ────────────────────────────────────────────────────────────
FECHA=$(date +'%Y-%m-%d_%H-%M-%S')
DIR_BACKUP=${BACKUP_DIR:-/var/backups/healthkids}
ARCHIVO="$DIR_BACKUP/healthkids_backup_$FECHA.sql.gz"
DIAS_RETENCION=${BACKUP_RETENTION_DAYS:-30}
LOG_FILE=${BACKUP_LOG:-/var/log/healthkids/backup.log}
ALERTA_EMAIL=${ALERT_EMAIL:-""}

# Variables de BD (leer desde .env si existe)
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-healthkids_db}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-""}

# ─── Funciones ────────────────────────────────────────────────────────────────
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

alerta() {
  log "ALERTA: $1"
  if [ -n "$ALERTA_EMAIL" ]; then
    echo "$1" | mail -s "[ALERTA] HealthKids Backup FAILED" "$ALERTA_EMAIL" 2>/dev/null || true
  fi
}

# ─── Pre-condiciones ──────────────────────────────────────────────────────────
mkdir -p "$DIR_BACKUP"
mkdir -p "$(dirname "$LOG_FILE")"

log "========================================"
log "Iniciando respaldo de HealthKids DB..."
log "Base de datos : $DB_NAME @ $DB_HOST:$DB_PORT"
log "Destino       : $ARCHIVO"

# ─── Ejecutar pg_dump comprimido ──────────────────────────────────────────────
if PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --no-password \
    --schema=healthkids \
    --verbose \
    --format=plain \
    2>>"$LOG_FILE" | gzip > "$ARCHIVO"; then

  # ─── Verificar integridad del respaldo con SHA-256 (RF-03) ─────────────────
  CHECKSUM=$(sha256sum "$ARCHIVO" | awk '{print $1}')
  echo "$CHECKSUM  $ARCHIVO" > "$ARCHIVO.sha256"

  TAMANO=$(du -sh "$ARCHIVO" | awk '{print $1}')

  log "Respaldo exitoso"
  log "Archivo  : $ARCHIVO ($TAMANO)"
  log "SHA-256  : $CHECKSUM"

else
  alerta "Fallo al ejecutar pg_dump. Revisar logs en $LOG_FILE"
  exit 1
fi

# ─── Verificar que el archivo no esté vacío ───────────────────────────────────
if [ ! -s "$ARCHIVO" ]; then
  alerta "El archivo de respaldo está vacío: $ARCHIVO"
  rm -f "$ARCHIVO" "$ARCHIVO.sha256"
  exit 1
fi

# ─── Limpiar respaldos anteriores a la retención ─────────────────────────────
ELIMINADOS=$(find "$DIR_BACKUP" -name '*.sql.gz' -mtime +"$DIAS_RETENCION" | wc -l)
find "$DIR_BACKUP" -name '*.sql.gz'        -mtime +"$DIAS_RETENCION" -delete
find "$DIR_BACKUP" -name '*.sql.gz.sha256' -mtime +"$DIAS_RETENCION" -delete

log "Limpieza: $ELIMINADOS respaldo(s) antiguo(s) eliminado(s)"
log "Respaldo completado exitosamente."
log "========================================"
