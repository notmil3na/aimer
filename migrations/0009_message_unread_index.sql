CREATE INDEX IF NOT EXISTS idx_messages_conversation_read_sender
  ON messages(conversation_id, read, sender);
