# Activar los avisos de DayBook en Telegram

Unos 15 minutos, una sola vez. Hazlo en este orden.

## 1. Crea el bot (2 min)

1. En Telegram abre **@BotFather** y escribe `/newbot`.
2. Nombre: `DayBook`. Usuario: algo que acabe en `bot`, por ejemplo `daybook_david_bot`.
3. Copia el **token** que te da y pégalo en `reminders_secrets.local.txt` (línea `TELEGRAM_BOT_TOKEN=`).

## 2. Supabase (3 min)

En Supabase > **SQL Editor**, ejecuta estos archivos de la carpeta `supabase/`, uno a uno:

1. `notifications_migration.sql` (tablas nuevas: ajustes, registro de avisos, registro de estudio).
2. `fix_bst_dates.sql` (corrige el desfase de un día de los hábitos guardados en horario de verano). Al final muestra una tabla: todas las filas deben tener `dow = 1` (lunes).

Después ve a **Project Settings > API Keys**, copia la clave **service_role** y pégala en `reminders_secrets.local.txt` (línea `SUPABASE_SERVICE_ROLE_KEY=`).

> Haz el paso 2.2 y el despliegue del paso 4 seguidos. Si pasan horas entre uno y otro, la semana actual del planner se verá vacía hasta desplegar.

## 3. Vercel (3 min)

Proyecto **daybook-app** > **Settings > Environment Variables**. Añade las cuatro variables de `reminders_secrets.local.txt` para **Production**:

- `CRON_SECRET`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY`

Comprueba también que `NEXT_PUBLIC_APP_URL` en Vercel es la URL pública de la app (no `localhost`).

## 4. Despliega (1 min)

En Terminal, desde la carpeta del proyecto:

```bash
cd ~/Claude/Projects/DayBook\ App
npm install
git add -A
git commit -m "Telegram reminders, study log, BST date fix"
git push
```

`reminders_secrets.local.txt` y `notifications_cron.local.sql` no se suben (están en `.gitignore`).

## 5. Conecta Telegram (1 min)

1. Abre DayBook, pestaña **Reminders**.
2. Pulsa **Connect Telegram**. Se abre tu bot: pulsa **Iniciar / Start**.
3. Vuelve a DayBook y pulsa **I pressed Start, check again**. Debe poner *Connected*.
4. Prueba los botones **Morning / Midday / Evening** para ver cada aviso.

## 6. Programa los avisos (2 min)

Abre `supabase/notifications_cron.local.sql` (ya lleva tu `CRON_SECRET`), sustituye `YOUR_APP_URL` por la URL pública de la app (sin barra final) y ejecútalo en el SQL Editor de Supabase.

Supabase llamará a la app cada 15 minutos; la app decide con la hora de Londres qué aviso toca y manda cada uno solo una vez al día. El cambio de hora no requiere nada.

Para comprobar que funciona, al día siguiente:

```sql
SELECT created, status_code, left(content, 300)
FROM net._http_response ORDER BY created DESC LIMIT 10;
```

`status_code` 200 es correcto. Un 401 significa que el secreto del SQL no coincide con `CRON_SECRET` en Vercel.

## Qué recibirás

| Hora | Aviso |
|---|---|
| 7:30 | Plan del día: hábitos, entreno, Top three, tickets que vencen, hitos, goals en riesgo. Lo que ayer quedó sin marcar, con botones. Racha de días. |
| 13:00 | Solo si queda algo abierto: hábitos y tickets de hoy, con botones. |
| 21:00 | Cierre del día: lo que falta, tickets vencidos, pendientes de la semana, si has estudiado. |
| Domingo 21:00 | Además, revisión semanal: % de hábitos y tendencia, hábitos flojos, horas de estudio por área, estado de cada goal, y aviso para fijar el Top three de la semana siguiente. |

Las horas y el día de la revisión se cambian en la pestaña **Reminders**.

## Comandos del bot

- `/hoy` qué te queda hoy
- `/estudio 45 Revenue Cloud` registra 45 minutos de estudio (añade `| nota` si quieres)
- `/semana` revisión de la semana en cualquier momento
- `/pausa` y `/activar`
