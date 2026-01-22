import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Local storage directory
const UPLOADS_DIR = path.join(process.cwd(), 'server', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Calculate SHA-256 hash of file content
 */
export function calculateHash(content: Buffer | string): string {
  const hash = crypto.createHash('sha256');
  hash.update(content);
  return hash.digest('hex');
}

/**
 * Generate a unique file key based on content hash and original filename
 */
export function generateFileKey(originalName: string, content: Buffer | string): string {
  const hash = calculateHash(content);
  const ext = path.extname(originalName);
  const timestamp = Date.now();
  return `${hash.substring(0, 16)}-${timestamp}${ext}`;
}

/**
 * Store a file locally
 * @returns Object with key and local URL
 */
export async function localStoragePut(
  fileKey: string,
  content: Buffer | string,
  contentType?: string
): Promise<{ key: string; url: string }> {
  const filePath = path.join(UPLOADS_DIR, fileKey);
  
  // Create subdirectories if fileKey contains path separators
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Write file
  fs.writeFileSync(filePath, content);
  
  // Store metadata
  const metadataPath = `${filePath}.meta.json`;
  fs.writeFileSync(metadataPath, JSON.stringify({
    contentType: contentType || 'application/octet-stream',
    size: Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content),
    createdAt: new Date().toISOString(),
  }));
  
  // Return local URL (will be served by download endpoint)
  const url = `/api/download/${encodeURIComponent(fileKey)}`;
  
  return { key: fileKey, url };
}

/**
 * Get a file from local storage
 * @returns Object with content, contentType, and size
 */
export async function localStorageGet(
  fileKey: string
): Promise<{ content: Buffer; contentType: string; size: number } | null> {
  const filePath = path.join(UPLOADS_DIR, fileKey);
  
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  const content = fs.readFileSync(filePath);
  
  // Read metadata
  const metadataPath = `${filePath}.meta.json`;
  let contentType = 'application/octet-stream';
  if (fs.existsSync(metadataPath)) {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    contentType = metadata.contentType;
  }
  
  return {
    content,
    contentType,
    size: content.length,
  };
}

/**
 * Delete a file from local storage
 */
export async function localStorageDelete(fileKey: string): Promise<boolean> {
  const filePath = path.join(UPLOADS_DIR, fileKey);
  const metadataPath = `${filePath}.meta.json`;
  
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    if (fs.existsSync(metadataPath)) {
      fs.unlinkSync(metadataPath);
    }
    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
}

/**
 * Check if a file exists in local storage
 */
export function localStorageExists(fileKey: string): boolean {
  const filePath = path.join(UPLOADS_DIR, fileKey);
  return fs.existsSync(filePath);
}

/**
 * List all files in local storage
 */
export function localStorageList(): string[] {
  const files: string[] = [];
  
  function walkDir(dir: string, prefix: string = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        walkDir(path.join(dir, entry.name), path.join(prefix, entry.name));
      } else if (!entry.name.endsWith('.meta.json')) {
        files.push(path.join(prefix, entry.name));
      }
    }
  }
  
  walkDir(UPLOADS_DIR);
  return files;
}

/**
 * Get file metadata without reading content
 */
export function localStorageGetMetadata(fileKey: string): {
  contentType: string;
  size: number;
  createdAt: string;
} | null {
  const filePath = path.join(UPLOADS_DIR, fileKey);
  const metadataPath = `${filePath}.meta.json`;
  
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  if (fs.existsSync(metadataPath)) {
    return JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  }
  
  // Fallback if no metadata file
  const stats = fs.statSync(filePath);
  return {
    contentType: 'application/octet-stream',
    size: stats.size,
    createdAt: stats.birthtime.toISOString(),
  };
}
