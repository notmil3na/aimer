// Límites y contabilidad del almacenamiento de adjuntos del chat.
// Cada subida queda registrada en `chat_uploads` antes de firmar el enlace, así
// el worker puede saber cuánto ocupa cada usuario y evitar que un enlace ya
// usado sobrescriba el adjunto de un mensaje existente.

export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_USER_STORAGE_BYTES = 100 * 1024 * 1024;
export const MAX_PENDING_UPLOADS = 30;

// El enlace de subida dura 6 h. Pasado ese tiempo una subida pendiente ya no
// puede completarse, así que se borra para que no ocupe cuota para siempre.
const PENDING_UPLOAD_TTL_MS = 6 * 60 * 60 * 1000;

export async function cleanupStaleUploads(db, bucket, username) {
  if (!bucket) return;
  const cutoff = new Date(Date.now() - PENDING_UPLOAD_TTL_MS).toISOString();
  const stale = await db
    .prepare(
      "SELECT path FROM chat_uploads WHERE username = ? AND consumed_at IS NULL AND created_at < ? LIMIT 20"
    )
    .bind(username, cutoff)
    .all();
  const paths = (stale.results || []).map((row) => row.path);
  if (!paths.length) return;

  for (const path of paths) {
    try {
      await bucket.delete(path);
    } catch (_) {}
  }
  const placeholders = paths.map(() => "?").join(",");
  await db.prepare(`DELETE FROM chat_uploads WHERE path IN (${placeholders})`).bind(...paths).run();
}

// Bytes ocupados por un usuario: adjuntos ya enviados + subidas todavía sin
// mensaje. Las subidas consumidas se excluyen para no contarlas dos veces,
// porque al enviar el mensaje su tamaño pasa a `message_attachments`.
export async function usedStorageBytes(db, username) {
  const sent = await db
    .prepare(
      `SELECT COALESCE(SUM(
                CASE
                  WHEN a.file_size IS NULL OR a.file_size < 0 THEN 0
                  WHEN a.file_size > 8388608 THEN 8388608
                  ELSE a.file_size
                END
              ), 0) AS total
         FROM message_attachments a
         JOIN messages m ON m.id = a.message_id
        WHERE m.sender = ?`
    )
    .bind(username)
    .first();

  const pending = await db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN actual_size IS NOT NULL THEN actual_size ELSE declared_size END), 0) AS total
         FROM chat_uploads
        WHERE username = ? AND consumed_at IS NULL`
    )
    .bind(username)
    .first();

  return (Number(sent?.total) || 0) + (Number(pending?.total) || 0);
}

export async function pendingUploadCount(db, username) {
  const row = await db
    .prepare("SELECT COUNT(*) AS total FROM chat_uploads WHERE username = ? AND consumed_at IS NULL")
    .bind(username)
    .first();
  return Number(row?.total) || 0;
}
