/**
 * Cloud Storage Connectors - Google Drive and SharePoint
 */

export interface CloudStorageConfig {
  provider: 'google_drive' | 'sharepoint';
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tenantId?: string;
}

export interface CloudFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  webUrl?: string;
  downloadUrl?: string;
}

export class GoogleDriveAdapter {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private accessToken?: string;

  constructor(config: CloudStorageConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      access_type: 'offline',
      state
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async exchangeCode(code: string): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code'
      })
    });
    const data = await response.json();
    this.accessToken = data.access_token;
    return { accessToken: data.access_token, refreshToken: data.refresh_token };
  }

  setToken(accessToken: string) { this.accessToken = accessToken; }

  async listFiles(folderId?: string): Promise<{ files: CloudFile[] }> {
    const query = folderId ? `'${folderId}' in parents` : "'root' in parents";
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink)`,
      { headers: { 'Authorization': `Bearer ${this.accessToken}` } }
    );
    const data = await response.json();
    return {
      files: (data.files || []).map((f: any) => ({
        id: f.id, name: f.name, mimeType: f.mimeType, size: parseInt(f.size) || 0,
        createdAt: new Date(f.createdTime), modifiedAt: new Date(f.modifiedTime), webUrl: f.webViewLink
      }))
    };
  }

  async downloadFile(fileId: string): Promise<Buffer> {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });
    return Buffer.from(await response.arrayBuffer());
  }
}

export class SharePointAdapter {
  private clientId: string;
  private clientSecret: string;
  private tenantId: string;
  private accessToken?: string;

  constructor(config: CloudStorageConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.tenantId = config.tenantId || 'common';
  }

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: 'Files.ReadWrite.All offline_access',
      state
    });
    return `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await fetch(`https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId, client_secret: this.clientSecret, code, redirect_uri: redirectUri, grant_type: 'authorization_code'
      })
    });
    const data = await response.json();
    this.accessToken = data.access_token;
    return { accessToken: data.access_token, refreshToken: data.refresh_token };
  }

  setToken(accessToken: string) { this.accessToken = accessToken; }

  async listFiles(folderId?: string): Promise<{ files: CloudFile[] }> {
    const path = folderId ? `/me/drive/items/${folderId}/children` : '/me/drive/root/children';
    const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });
    const data = await response.json();
    return {
      files: (data.value || []).map((f: any) => ({
        id: f.id, name: f.name, mimeType: f.file?.mimeType || 'application/octet-stream', size: f.size || 0,
        createdAt: new Date(f.createdDateTime), modifiedAt: new Date(f.lastModifiedDateTime), webUrl: f.webUrl
      }))
    };
  }

  async downloadFile(fileId: string): Promise<Buffer> {
    const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`, {
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });
    return Buffer.from(await response.arrayBuffer());
  }
}

export function createCloudStorageAdapter(config: CloudStorageConfig) {
  return config.provider === 'google_drive' ? new GoogleDriveAdapter(config) : new SharePointAdapter(config);
}

export default { createCloudStorageAdapter, GoogleDriveAdapter, SharePointAdapter };
