
let clientPromise = null;

function getClient() {
  if (clientPromise) return clientPromise;
  clientPromise = import("@supabase/supabase-js").then(({ createClient }) => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });
  return clientPromise;
}

export function createConversationStream(token, onMessage, onStatus) {
  let client = null;
  let channel = null;
  let closed = false;
  let connected = false;

  const report = (status) => {
    if (onStatus && !closed) {
      try {
        onStatus(status);
      } catch (_) {}
    }
  };

  const ready = getClient().then((c) => {
    if (!c || !token || closed) {
      report("NO_CLIENT");
      return "NO_CLIENT";
    }
    client = c;
    channel = c.channel(`chat:${token}`);
    channel.on("broadcast", { event: "message" }, (payload) => {
      if (onMessage && !closed) {
        try {
          onMessage(payload && payload.payload ? payload.payload : {});
        } catch (_) {}
      }
    });
    return new Promise((resolve) => {
      channel.subscribe((status) => {
        connected = status === "SUBSCRIBED";
        report(status);
        resolve(status);
      });
    });
  });

  return {
    send(payload) {
      ready.then(async () => {
        if (!channel || closed || !connected) return;
        try {
          await channel.send({ type: "broadcast", event: "message", payload });
        } catch (_) {}
      });
    },
    close() {
      closed = true;
      ready.then(() => {
        if (channel && client) client.removeChannel(channel);
        channel = null;
      });
    },
  };
}
