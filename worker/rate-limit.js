// Rate limiting basado en D1.
// Cada endpoint define sus propios límites; este módulo solo maneja la tabla.
//
// Diseño:
//   - `key` identifica qué se limita (p.ej. "forgot:juanito", "login:1.2.3.4").
//   - Se permite `maxAttempts` intentos en una ventana de `windowSec` segundos.
//   - Al superar el límite se bloquea durante `lockoutSec` segundos.
//   - `checkAndIncrement` devuelve { allowed, retryAfter }.
//   - `reset` borra el contador (p.ej. después de un login correcto).

/**
 * @param {D1Database} db
 * @param {string}     key          p.ej. "forgot:juanito"
 * @param {object}     opts
 * @param {number}     opts.maxAttempts  intentos permitidos dentro de la ventana
 * @param {number}     opts.windowSec    duración de la ventana (s)
 * @param {number}     opts.lockoutSec   bloqueo tras superar el límite (s)
 * @returns {Promise<{allowed: boolean, retryAfter: number}>}
 */
export async function checkAndIncrement(db, key, { maxAttempts, windowSec, lockoutSec }) {
  const now = new Date();
  const nowISO = now.toISOString();
  const windowCutoff = new Date(now.getTime() - windowSec * 1000).toISOString();
  const lockedUntil = new Date(now.getTime() + lockoutSec * 1000).toISOString();

  // El upsert serializa el incremento por `key`: solicitudes simultáneas no
  // pueden leer el mismo contador y aprobarse todas antes de actualizarlo.
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, attempts, locked_until, window_start)
       VALUES (?, 1, NULL, ?)
       ON CONFLICT(key) DO UPDATE SET
         attempts = CASE
           WHEN rate_limits.locked_until > ? THEN rate_limits.attempts
           WHEN rate_limits.locked_until IS NOT NULL OR rate_limits.window_start < ? THEN 1
           ELSE rate_limits.attempts + 1
         END,
         locked_until = CASE
           WHEN rate_limits.locked_until > ? THEN rate_limits.locked_until
           WHEN rate_limits.locked_until IS NOT NULL OR rate_limits.window_start < ? THEN NULL
           WHEN rate_limits.attempts >= ? THEN ?
           ELSE NULL
         END,
         window_start = CASE
           WHEN rate_limits.locked_until > ? THEN rate_limits.window_start
           WHEN rate_limits.locked_until IS NOT NULL OR rate_limits.window_start < ? THEN ?
           ELSE rate_limits.window_start
         END
       RETURNING attempts, locked_until`
    )
    .bind(
      key,
      nowISO,
      nowISO,
      windowCutoff,
      nowISO,
      windowCutoff,
      maxAttempts,
      lockedUntil,
      nowISO,
      windowCutoff,
      nowISO,
    )
    .first();

  const until = row?.locked_until ? new Date(row.locked_until) : null;
  const retryAfter = until && until > now ? Math.ceil((until - now) / 1000) : 0;
  return {
    allowed: Number(row?.attempts) <= maxAttempts && retryAfter === 0,
    retryAfter,
  };
}

/**
 * Reinicia el contador de un key (p.ej. tras un login exitoso).
 */
export async function resetLimit(db, key) {
  await db.prepare("DELETE FROM rate_limits WHERE key = ?").bind(key).run();
}

/**
 * Limpia entradas expiradas (opcional, para un cron de mantenimiento).
 */
export async function purgeExpired(db) {
  const now = new Date().toISOString();
  await db
    .prepare("DELETE FROM rate_limits WHERE locked_until IS NOT NULL AND locked_until < ?")
    .bind(now)
    .run();
}
