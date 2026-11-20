/**
 * Progress-photo vault: photos are encrypted in the browser and kept in this device's IndexedDB.
 * They are never uploaded: the server has no route that accepts them, they are not in the data
 * export, and the app's Content-Security-Policy only lets pages talk to Waypoint's own server.
 *
 * Crypto: a passcode → PBKDF2-SHA-256 (600,000 rounds, random 16-byte salt) → AES-256-GCM key,
 * created non-extractable and held only in memory while unlocked. Each photo (with its date and
 * note) is one AES-GCM ciphertext with its own random 12-byte IV. A forgotten passcode cannot be
 * recovered; the vault can only be wiped.
 */

export const PBKDF2_ROUNDS = 600_000;
const CHECK_TEXT = 'waypoint-vault-ok';
const enc = new TextEncoder();
const dec = new TextDecoder();

export interface VaultMeta {
  salt: Uint8Array;
  rounds: number;
  check: { iv: Uint8Array; ct: ArrayBuffer };
  createdAt: number;
}
interface StoredPhoto {
  id: string;
  createdAt: number;
  iv: Uint8Array;
  ct: ArrayBuffer;
}
export interface VaultPhoto {
  id: string;
  createdAt: number;
  date: string;
  note: string;
  /** An object URL for the decrypted JPEG; revoked when the vault locks. */
  url: string;
}

/* ---------- IndexedDB (one database per account, so a shared device keeps accounts apart) ---------- */

function open(userId: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(`waypoint-vault-${userId}`, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('meta');
      r.result.createObjectStore('photos', { keyPath: 'id' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function store(userId: string, name: 'meta' | 'photos', mode: IDBTransactionMode) {
  const db = await open(userId);
  return db.transaction(name, mode).objectStore(name);
}

/* ---------- crypto ---------- */

export async function deriveKey(passcode: string, salt: Uint8Array, rounds = PBKDF2_ROUNDS): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passcode), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: rounds },
    base,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable: the key can be used, never read out
    ['encrypt', 'decrypt'],
  );
}

async function seal(key: CryptoKey, data: Uint8Array): Promise<{ iv: Uint8Array; ct: ArrayBuffer }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return { iv, ct: await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, data as BufferSource) };
}

async function open_(key: CryptoKey, iv: Uint8Array, ct: ArrayBuffer): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ct));
}

/* ---------- vault ---------- */

export async function vaultMeta(userId: string): Promise<VaultMeta | null> {
  return ((await req((await store(userId, 'meta', 'readonly')).get('meta'))) as VaultMeta | undefined) ?? null;
}

export async function createVault(userId: string, passcode: string): Promise<CryptoKey> {
  if (passcode.length < 6) throw new Error('Use at least 6 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passcode, salt);
  const check = await seal(key, enc.encode(CHECK_TEXT));
  const meta: VaultMeta = { salt, rounds: PBKDF2_ROUNDS, check, createdAt: Date.now() };
  await req((await store(userId, 'meta', 'readwrite')).put(meta, 'meta'));
  return key;
}

/** The key if the passcode is right; null if it's wrong. */
export async function unlockVault(userId: string, passcode: string): Promise<CryptoKey | null> {
  const meta = await vaultMeta(userId);
  if (!meta) throw new Error('There is no vault on this device yet.');
  const key = await deriveKey(passcode, meta.salt, meta.rounds);
  try {
    return dec.decode(await open_(key, meta.check.iv, meta.check.ct)) === CHECK_TEXT ? key : null;
  } catch {
    return null; // AES-GCM refuses to decrypt with the wrong key
  }
}

const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export async function addPhoto(userId: string, key: CryptoKey, photo: { jpegBase64: string; date: string; note: string }): Promise<void> {
  const payload = enc.encode(JSON.stringify({ date: photo.date, note: photo.note, image: photo.jpegBase64 }));
  const sealed = await seal(key, payload);
  const row: StoredPhoto = { id: crypto.randomUUID(), createdAt: Date.now(), ...sealed };
  await req((await store(userId, 'photos', 'readwrite')).put(row));
}

/** Decrypt every photo; newest date first. Callers must revoke the URLs (see lockPhotos). */
export async function readPhotos(userId: string, key: CryptoKey): Promise<VaultPhoto[]> {
  const rows = (await req((await store(userId, 'photos', 'readonly')).getAll())) as StoredPhoto[];
  const out: VaultPhoto[] = [];
  for (const r of rows) {
    try {
      const p = JSON.parse(dec.decode(await open_(key, r.iv, r.ct))) as { date: string; note: string; image: string };
      const url = URL.createObjectURL(new Blob([b64ToBytes(p.image) as BlobPart], { type: 'image/jpeg' }));
      out.push({ id: r.id, createdAt: r.createdAt, date: p.date, note: p.note, url });
    } catch {
      /* a damaged entry is skipped, never shown half-decrypted */
    }
  }
  return out.sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
}

export function lockPhotos(photos: VaultPhoto[]) {
  for (const p of photos) URL.revokeObjectURL(p.url);
}

export async function deletePhoto(userId: string, id: string): Promise<void> {
  await req((await store(userId, 'photos', 'readwrite')).delete(id));
}

/** Deletes the vault and every photo in it from this device. */
export function wipeVault(userId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.deleteDatabase(`waypoint-vault-${userId}`);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
    r.onblocked = () => resolve();
  });
}
