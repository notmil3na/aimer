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

  const row = await db
    .prepare("SELECT attempts, locked_until, window_start FROM rate_limits WHERE key = ?")
    .bind(key)
    .first();

  // ¿Está bloqueado?
  if (row?.locked_until) {
    const until = new Date(row.locked_until);
    if (now < until) {
      return { allowed: false, retryAfter: Math.ceil((until - now) / 1000) };
    }
    // El bloqueo expiró → reiniciar
    await db
      .prepare("UPDATE rate_limits SET attempts = 1, locked_until = NULL, window_start = ? WHERE key = ?")
      .bind(nowISO, key)
      .run();
    return { allowed: true, retryAfter: 0 };
  }

  if (!row) {
    // Primera vez
    await db
      .prepare("INSERT INTO rate_limits (key, attempts, locked_until, window_start) VALUES (?, 1, NULL, ?)")
      .bind(key, nowISO)
      .run();
    return { allowed: true, retryAfter: 0 };
  }

  // ¿La ventana expiró?
  const windowStart = new Date(row.window_start);
  if (now - windowStart > windowSec * 1000) {
    // Reiniciar ventana
    await db
      .prepare("UPDATE rate_limits SET attempts = 1, locked_until = NULL, window_start = ? WHERE key = ?")
      .bind(nowISO, key)
      .run();
    return { allowed: true, retryAfter: 0 };
  }

  const newAttempts = row.attempts + 1;

  if (newAttempts > maxAttempts) {
    // Bloquear
    const lockedUntil = new Date(now.getTime() + lockoutSec * 1000).toISOString();
    await db
      .prepare("UPDATE rate_limits SET attempts = ?, locked_until = ?, window_start = ? WHERE key = ?")
      .bind(newAttempts, lockedUntil, row.window_start, key)
      .run();
    return { allowed: false, retryAfter: lockoutSec };
  }

  // Incrementar
  await db
    .prepare("UPDATE rate_limits SET attempts = ? WHERE key = ?")
    .bind(newAttempts, key)
    .run();
  return { allowed: true, retryAfter: 0 };
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
