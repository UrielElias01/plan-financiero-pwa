import { normalizeState } from "./calculations";
import type { AppState } from "./types";

type EncryptedPayload = {
  version: number;
  algorithm: string;
  kdf: string;
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  updatedAt: string;
};

function getCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Este navegador no soporta Web Crypto");
  }
  return globalThis.crypto;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  getCrypto().getRandomValues(bytes);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await getCrypto().subtle.digest("SHA-256", new TextEncoder().encode(text));
  return bytesToHex(new Uint8Array(digest));
}

async function deriveEncryptionKey(passphrase: string, saltBytes: Uint8Array): Promise<CryptoKey> {
  const baseKey = await getCrypto().subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return getCrypto().subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 250000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export function normalizeEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, "");
}

export async function syncSecret(passphrase: string): Promise<string> {
  return sha256Hex(`plan-financiero-sync:${passphrase}`);
}

export async function encryptStateForSync(state: AppState, passphrase: string): Promise<EncryptedPayload> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveEncryptionKey(passphrase, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(state));
  const ciphertext = await getCrypto().subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return {
    version: 1,
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA256",
    iterations: 250000,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    updatedAt: new Date().toISOString(),
  };
}

export async function decryptStateFromSync(payload: EncryptedPayload, passphrase: string): Promise<AppState> {
  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const ciphertext = base64ToBytes(payload.ciphertext);
  const key = await deriveEncryptionKey(passphrase, salt);
  const plaintext = await getCrypto().subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return normalizeState(JSON.parse(new TextDecoder().decode(plaintext)));
}

export async function fetchSync<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(body?.error || `Error HTTP ${response.status}`);
  }
  return body as T;
}
