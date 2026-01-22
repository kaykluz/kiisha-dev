// Preconfigured storage helpers for Manus WebDev templates
// Uses the Biz-provided storage proxy (Authorization: Bearer <token>)
// Falls back to local filesystem storage when S3/proxy is not configured

import { ENV } from './_core/env';
import {
  localStoragePut,
  localStorageGet,
  localStorageExists,
  generateFileKey,
  calculateHash,
} from './localStorage';

type StorageConfig = { baseUrl: string; apiKey: string } | null;

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    // Return null to indicate local storage should be used
    return null;
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function isLocalStorageMode(): boolean {
  return getStorageConfig() === null;
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  return (await response.json()).url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

/**
 * Upload a file to storage (S3 or local filesystem)
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const config = getStorageConfig();
  
  // Use local storage if S3 not configured
  if (!config) {
    const buffer = typeof data === 'string' ? Buffer.from(data) : Buffer.from(data);
    return localStoragePut(normalizeKey(relKey), buffer, contentType);
  }
  
  // Use S3 proxy
  const { baseUrl, apiKey } = config;
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

/**
 * Get a download URL for a file
 */
export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  const config = getStorageConfig();
  const key = normalizeKey(relKey);
  
  // Use local storage if S3 not configured
  if (!config) {
    return {
      key,
      url: `/api/download/${encodeURIComponent(key)}`,
    };
  }
  
  // Use S3 proxy
  const { baseUrl, apiKey } = config;
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey),
  };
}

/**
 * Check if using local storage mode
 */
export function isUsingLocalStorage(): boolean {
  return isLocalStorageMode();
}

/**
 * Get file content from local storage (only works in local mode)
 */
export async function storageGetContent(relKey: string): Promise<{
  content: Buffer;
  contentType: string;
  size: number;
} | null> {
  const key = normalizeKey(relKey);
  return localStorageGet(key);
}

/**
 * Check if a file exists in storage
 */
export function storageExists(relKey: string): boolean {
  const key = normalizeKey(relKey);
  return localStorageExists(key);
}

/**
 * Calculate hash of content for deduplication
 */
export function storageCalculateHash(content: Buffer | string): string {
  return calculateHash(content);
}

/**
 * Generate a unique file key
 */
export function storageGenerateKey(originalName: string, content: Buffer | string): string {
  return generateFileKey(originalName, content);
}
