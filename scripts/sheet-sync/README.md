# Sync MyTracc -> Google Sheets del entrenador

Corre cada noche via GitHub Actions (`.github/workflows/sheet-sync.yml`) y copia datos de Supabase a los dos Sheets del coach, sin tocar las celdas que rellena el coach a mano.

## Que sincroniza

- **REGISTRO SEMANAL NUEVO**: `daily_metrics` (pasos, peso, horas de sueño, tipo de entreno, comentario del dia) -> filas ENTRENAMIENTO/NEAT (PASOS)/PESO CORPORAL/HORAS DE SUEÑO/COMENTARIOS de la pestaña MES que corresponda, calculada por fecha.
- **PLAN ENTRENAMIENTO HUGO**: `workout_sessions` + `workout_sets` + `exercise_notes` -> columnas numeradas (1, 2, 3...) del bloque de cada tipo de sesión (PUSH/PULL/LEG/TORSO) en la pestaña del mesociclo activo.

**No sincroniza** el bloque "PREGUNTAS" (reflexión quincenal) porque no hay una correspondencia clara entre esos campos de texto libre y los datos que guarda `weekly_checkins` en Supabase — eso se sigue rellenando a mano.

## Que hacer cuando cambie el mesociclo

Cuando el coach pase de "MESOCICLO 2" a "MESOCICLO 3" (o cree una pestaña nueva), actualiza la variable de Actions `ACTIVE_MESOCICLO_TAB` en:

`Settings -> Secrets and variables -> Actions -> Variables` del repo, con el nombre exacto de la pestaña nueva.

## Reglas de "no pisar al coach"

- Columnas numeradas del registro de entrenamiento y su COMENTARIOS de ejercicio: se sobrescriben siempre (igual que haces tu a mano cuando entrenas encima de lo que el coach apuntó).
- Fila COMENTARIOS del sheet semanal: el script recuerda el ultimo valor que escribio (tabla `sheet_sync_state` en Supabase). Si la celda ya no coincide con eso, alguien la toco a mano y el script la deja en paz (se ve un aviso en los logs de la Action).

## Variables y secretos necesarios (GitHub Actions)

Secrets: `SUPABASE_SECRET_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON_B64` (el JSON de la cuenta de servicio de Google, en base64).

Variables: `SUPABASE_URL`, `CLIENT_ID`, `GOOGLE_CLIENT_EMAIL`, `SPREADSHEET_ID_WEEKLY`, `SPREADSHEET_ID_PLAN`, `ACTIVE_MESOCICLO_TAB`.

## Probarlo a mano

En la pestaña **Actions** del repo, entra al workflow "Sync MyTracc -> Google Sheets" y usa **Run workflow** para lanzarlo sin esperar a la noche.

## Limitaciones conocidas

Este script se escribio y revisó sin poder ejecutarlo localmente (no habia Node.js instalado en el entorno donde se creo). La primera ejecución real debería lanzarse a mano (`Run workflow`) y revisar los logs antes de confiar en el cron nocturno.
