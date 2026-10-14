import { api } from "../api";

export function canonicalPair(a, b) {
  return a < b ? [a, b] : [b, a];
}

export const FRIENDSHIP_TABLE_MISSING = "42P01";

const cache = new Map();
const CACHE_TTL = 60 * 1000;

function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return Promise.resolve(hit.value);
  return fn().then((res) => {
    if (!res.error && !res.missingTable) cache.set(key, { at: Date.now(), value: res });
    return res;
  });
}

function invalidate(key) {
  cache.delete(key);
}

function wrap(promise) {
  return promise.then(
    (res) => ({ error: null, data: res.data ?? null, missingTable: false }),
    (err) => ({ error: err, data: null, missingTable: false })
  );
}

export function fetchFriendships(username) {
  return cached(`friendships:${username}`, () => wrap(api("/friendships")));
}

export function sendFriendRequest(me, other) {
  invalidate(`friendships:${me}`);
  return wrap(api("/friendships", { method: "POST", body: { action: "request", other } }));
}

export function acceptFriendship(me, other) {
  invalidate(`friendships:${me}`);
  return wrap(api("/friendships", { method: "POST", body: { action: "accept", other } }));
}

export function removeFriendship(me, other) {
  invalidate(`friendships:${me}`);
  return wrap(api("/friendships", { method: "POST", body: { action: "remove", other } }));
}

export function fetchUsersBrief() {
  return cached("users", () => wrap(api("/users")));
}

export function searchUsers(q) {
  if (!q || !q.trim()) return fetchUsersBrief();
  return wrap(api(`/users?q=${encodeURIComponent(q.trim())}`));
}

export function fetchFriendData(username) {
  return wrap(api(`/user_data/${encodeURIComponent(username)}`));
}
