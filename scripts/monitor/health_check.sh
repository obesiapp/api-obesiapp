#!/bin/bash
# =============================================================================
#  RF-05 — Monitoreo automático del sistema (cron cada 5 minutos)
#  Cron: */5 * * * * /bin/bash /scripts/monitor/health_check.sh
# =============================================================================

set -euo pipefail

URL=${HEALTH_URL:-"http://localhost:3000/health"}
LOG=${MONITOR_LOG:-/var/log/healthkids/monitor.log}
ALERTA_EMAIL=${ALERT_EMAIL:-""}
TIMESTAMP=$(date +'%Y-%m-%d %H:%M:%S')

mkdir -p "$(dirname "$LOG")"

# Ejecutar health check
HTTP_CODE=$(curl -sk -o /tmp/hk_health.json -w '%{http_code}' "$URL" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" -eq 200 ]; then
  UPTIME=$(python3 -c "import json; d=json.load(open('/tmp/hk_health.json')); print(d.get('uptime','?'))" 2>/dev/null || echo "?")
  DB_STATUS=$(python3 -c "import json; d=json.load(open('/tmp/hk_health.json')); print(d.get('db','?'))" 2>/dev/null || echo "?")
  echo "[$TIMESTAMP] OK — Uptime: $UPTIME | DB: $DB_STATUS" >> "$LOG"
else
  echo "[$TIMESTAMP] ALERTA: HealthKids API no disponible — HTTP $HTTP_CODE" >> "$LOG"

  if [ -n "$ALERTA_EMAIL" ]; then
    echo "HealthKids API no responde. HTTP: $HTTP_CODE — $TIMESTAMP" \
      | mail -s "[ALERTA] HealthKids API DOWN" "$ALERTA_EMAIL" 2>/dev/null || true
  fi

  # Reinicio de emergencia con PM2
  if command -v pm2 &>/dev/null; then
    pm2 restart healthkids-api >> "$LOG" 2>&1 || true
    echo "[$TIMESTAMP] Reinicio de emergencia PM2 ejecutado" >> "$LOG"
  fi
fi

rm -f /tmp/hk_health.json
