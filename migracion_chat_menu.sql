-- MiMalla · Migración: menú de chats (fijar / vaciar / eliminar)
-- =============================================================
-- Cómo usar:
--   1. Abre el dashboard de Supabase → SQL Editor.
--   2. Pega TODO este script y presiona "Run".
--   3. Listo: cada usuario puede fijar, vaciar o eliminar un chat
--      sin afectar al otro usuario de la conversación.
--
--   pinned_at  → chat fijado arriba en la lista (null = no fijado)
--   cleared_at → se ocultan los mensajes anteriores a esta fecha
--   hidden_at  → el chat desaparece de la lista; vuelve a aparecer
--                si llega un mensaje nuevo después de esta fecha
--
-- Nota: ALTER ... IF NOT EXISTS es idempotente; si las columnas ya
-- existen no hace nada, así que se puede ejecutar sin riesgo.

alter table public.conversation_members
  add column if not exists pinned_at  timestamptz,
  add column if not exists cleared_at timestamptz,
  add column if not exists hidden_at  timestamptz;
