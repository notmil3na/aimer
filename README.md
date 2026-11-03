Aimer es un proyecto universitario hecho por y para los estudiantes de la Universidad del magdalena que buscan 
tener un mejor orden o constancia de su avance académico.

Puedes encontrar todas las herramientas para avanzar en tu semestre: malla curricular, el horario, las notas, las tareas y hasta tus amigos, en un solo 
lugar y sin tener que andar con mil apps, excels y capturas perdidas en el celular.

Por qué existe
Si quieres llevar la cuenta de qué materias ya viste, cuáles te faltan, qué prerrequisitos te están frenando tu hoja de vida y qué entregas tienes esta semana puede ser un caos si todo está regado. Aimer nació de la necesidad de tenerlo todo en un mismo lugar, que se vea bonito y que funcione incluso cuando el internet de la universidad decide no cooperar.

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
