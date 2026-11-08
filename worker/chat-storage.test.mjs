import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./chat-storage.js", import.meta.url), "utf8");
const { deleteUserMessages } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);

test("deletes a chat with attachments from D1 before deleting its R2 objects", async () => {
  const events = [];
  const sql = [];
  const db = {
    prepare(query) {
      const statement = {
        query,
        bindings: [],
        bind(...values) {
          this.bindings = values;
          return this;
        },
        async all() {
          events.push("select-paths");
          sql.push({ query: this.query, bindings: this.bindings });
          return { results: [{ path: "chat/image.jpg" }, { path: "chat/image.jpg" }, { path: "chat/other.png" }] };
        },
      };
      return statement;
    },
    async batch(statements) {
      events.push("batch");
      sql.push(...statements.map(({ query, bindings }) => ({ query, bindings })));
    },
  };
  const bucket = {
    async delete(paths) {
      events.push("delete-r2");
      assert.deepEqual(paths, ["chat/image.jpg", "chat/other.png"]);
    },
  };

  const deletedCount = await deleteUserMessages(db, bucket, "alice", "conversation-1");

  assert.equal(deletedCount, 2);
  assert.deepEqual(events, ["select-paths", "batch", "delete-r2"]);
  assert.match(sql[0].query, /JOIN messages m ON m\.id = a\.message_id\s+WHERE m\.sender = \? AND m\.conversation_id = \?/);
  for (const statement of sql.slice(1, 4)) {
    assert.doesNotMatch(statement.query, /m\.sender|m\.conversation_id/);
    assert.match(statement.query, /sender = \? AND conversation_id = \?/);
    assert.deepEqual(statement.bindings, ["alice", "conversation-1"]);
  }
  assert.match(sql[4].query, /username = \? AND conversation_id = \?/);
  assert.deepEqual(sql[4].bindings, ["alice", "conversation-1"]);
});
