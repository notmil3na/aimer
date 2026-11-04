Aimer es un proyecto universitario hecho por y para los estudiantes de la Universidad del magdalena que buscan 
tener un mejor orden o constancia de su avance académico.

Puedes encontrar todas las herramientas para avanzar en tu semestre: malla curricular, el horario, las notas, las tareas y hasta tus amigos, en un solo 
lugar y sin tener que andar con mil apps, excels y capturas perdidas en el celular.

Por qué existe
Si quieres llevar la cuenta de qué materias ya viste, cuáles te faltan, qué prerrequisitos te están frenando tu hoja de vida y qué entregas tienes esta semana puede ser un caos si todo está regado. Aimer nació de la necesidad de tenerlo todo en un mismo lugar, que se vea bonito y que funcione incluso cuando el internet de la universidad decide no cooperar.

Desarrollo y despliegue
-----------------------

Requiere Node.js y npm. Para instalar dependencias y levantar el frontend:

```powershell
npm ci
npm run dev
```

En desarrollo, Vite reenvía `/api` al Worker de producción configurado en `vite.config.mjs`; las operaciones de API pueden modificar datos reales. Para compilar y revisar el sitio localmente:

```powershell
npm run build
npm run preview
```

El despliegue de producción usa Cloudflare Workers, D1 y R2. Configura primero los secretos indicados en esta guía y luego aplica las migraciones, compila los assets y despliega:

```powershell
npx wrangler d1 migrations apply aimer --remote
npm run build
npx wrangler deploy
```

Vercel solo redirige el tráfico a la URL del Worker; no aloja el frontend ni el backend.

El entorno `staging` tiene un Worker, una D1 y un bucket R2 separados, y no programa el cron diario. Para aplicar cambios y desplegar allí:

```powershell
npx wrangler d1 migrations apply aimer-staging --remote --env staging
npm run build
npx wrangler deploy --env staging
```

Los secretos de staging (`SESSION_SECRET`, `R2_SIGNING_SECRET`, `CRON_SECRET`, `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY`) se configuran por separado con `npx wrangler secret put NOMBRE --env staging`; nunca reutilices secretos de producción.

El cron diario de producción procesa datos y envía Web Push desde el Worker. Antes de aumentar su volumen o el costo de `scrypt`, mide tiempo de CPU y subrequests desde métricas/traces desplegadas. No ejecutes pruebas de carga ni el cron manual contra datos reales sin autorización.

Medición inicial en staging (4 nov. 2026): seis inicios fallidos con usuario inexistente ejercitaron la verificación scrypt de relleno y registraron 38–52 ms de CPU por petición. Un recorrido manual del cron con 40 filas sintéticas y cero suscripciones válidas registró 42 ms de CPU, 1,27 s de pared, `checked: 40` y cero envíos. No se generaron notificaciones. Esta prueba no cubre el costo de enviar push ni la carga máxima; confirma el plan y su límite de CPU efectivo antes de concluir compatibilidad con el límite gratuito de 10 ms.

Restablecimiento administrativo de contraseñas
-----------------------------------------------

El endpoint `POST /api/admin/reset-password` permite a un operador restablecer una contraseña tras verificar la identidad del usuario por un canal confiable. Además, las cuentas con rol de administrador tienen un panel privado dentro de la aplicación. La solicitud de restablecimiento requiere `X-Admin-Reset-Secret`, configurado exclusivamente como secreto de Cloudflare; nunca lo incluyas en el frontend ni en el repositorio.

Antes de desplegar esta función, aplica la migración que añade control de sesiones y configura un secreto aleatorio de al menos 32 bytes:

```powershell
npx wrangler d1 migrations apply aimer --remote
npx wrangler secret put ADMIN_RESET_SECRET
npx wrangler deploy
```

Guarda el mismo secreto en un gestor de contraseñas de operadores. Para restablecer una cuenta, envía al endpoint el nombre exacto de usuario y una contraseña temporal de al menos 12 caracteres en `newPassword`. Usa HTTPS y no compartas la contraseña temporal por este chat. El restablecimiento invalida las sesiones existentes; entrega la contraseña temporal al usuario por un canal privado y pídele cambiarla después de iniciar sesión. Rota `ADMIN_RESET_SECRET` de inmediato si sospechas que se expuso.

Ejemplo desde PowerShell (solicita el secreto y la contraseña sin mostrarlos al escribir):

```powershell
$secret = [System.Net.NetworkCredential]::new('', (Read-Host 'Secreto de administrador' -AsSecureString)).Password
$temporaryPassword = [System.Net.NetworkCredential]::new('', (Read-Host 'Contraseña temporal (12+ caracteres)' -AsSecureString)).Password
$body = @{ username = 'Figueroa'; newPassword = $temporaryPassword } | ConvertTo-Json
Invoke-RestMethod -Method Post `
  -Uri 'https://aimer-project.yaritzamilena4.workers.dev/api/admin/reset-password' `
  -Headers @{ 'X-Admin-Reset-Secret' = $secret } `
  -ContentType 'application/json' -Body $body
Remove-Variable secret, temporaryPassword, body
```

Cuenta administradora y edición global
--------------------------------------

Para asignar por primera vez el rol de administrador a una cuenta existente, aplica las migraciones, configura `ADMIN_BOOTSTRAP_SECRET` como secreto de Cloudflare (aleatorio, mínimo 32 bytes) y despliega. La cuenta debe estar registrada antes de ejecutar la configuración inicial:

```powershell
npx wrangler d1 migrations apply aimer --remote
npx wrangler secret put ADMIN_BOOTSTRAP_SECRET
npx wrangler deploy
```

Ejecuta una sola vez el aprovisionamiento desde PowerShell. El secreto se solicita como entrada segura y no se envía al frontend:

```powershell
$secret = [System.Net.NetworkCredential]::new('', (Read-Host 'Secreto inicial de administración' -AsSecureString)).Password
$body = @{ username = 'milenita' } | ConvertTo-Json
Invoke-RestMethod -Method Post `
  -Uri 'https://aimer-project.yaritzamilena4.workers.dev/api/admin/bootstrap' `
  -Headers @{ 'X-Admin-Bootstrap-Secret' = $secret } `
  -ContentType 'application/json' -Body $body
Remove-Variable secret, body
```

Después de confirmar la respuesta `{ "ok": true }`, elimina el secreto de aprovisionamiento (`npx wrangler secret delete ADMIN_BOOTSTRAP_SECRET`). El rol queda guardado en la base de datos. Al iniciar sesión con esa cuenta, el botón de escudo permite entrar o salir del modo administrador; desde allí se pueden gestionar perfiles, restablecer contraseñas y eliminar cuentas. En cualquier sección, con el modo activo, haz clic en un texto para cambiarlo globalmente. Los cambios se guardan en D1 y se aplican como texto plano para evitar interpretar contenido como HTML.

Sesiones y enlaces de adjuntos
------------------------------

La sesión vive en una cookie `HttpOnly` y los JWT nuevos duran 7 días (12 horas si no se marca "recordarme"). Al cerrar sesión se revoca el token en D1, así que ya no sirve aunque alguien lo hubiera copiado. Los cambios de contraseña y los restablecimientos administrativos invalidan las demás sesiones mediante `session_version`.

Los enlaces firmados de R2 usan una clave distinta de la del JWT. Configura un secreto independiente antes de desplegar (si no existe, se deriva una subclave desde `SESSION_SECRET`, pero lo recomendable es separarlo):

```powershell
npx wrangler secret put R2_SIGNING_SECRET
```

Aplica también la migración de sesiones revocadas:

```powershell
npx wrangler d1 migrations apply aimer --remote
npx wrangler deploy
```
