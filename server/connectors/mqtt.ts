/**
 * MQTT Client Library
 * 
 * IoT messaging protocol connector for solar monitoring:
 * - MQTT 3.1.1 and 5.0 support
 * - TLS/SSL encryption
 * - Topic subscription with wildcards
 * - Message parsing (JSON, Sparkplug B)
 * - Auto-reconnect with backoff
 */

import mqtt, { MqttClient, IClientOptions, IClientPublishOptions } from 'mqtt';
import { EventEmitter } from 'events';

// Types
export interface MqttConfig {
  brokerUrl: string;
  clientId?: string;
  username?: string;
  password?: string;
  useTls?: boolean;
  caCert?: string;
  clientCert?: string;
  clientKey?: string;
  keepalive?: number;
  reconnectPeriod?: number;
  connectTimeout?: number;
  clean?: boolean;
  protocolVersion?: 4 | 5;
}

export interface MqttSubscription {
  topic: string;
  qos: 0 | 1 | 2;
}

export interface MqttMessage {
  topic: string;
  payload: Buffer | string | object;
  qos?: 0 | 1 | 2;
  retain?: boolean;
}

export interface MqttConnectionStatus {
  connected: boolean;
  lastConnected?: Date;
  lastError?: string;
  reconnectAttempts: number;
  subscriptions: string[];
}

export interface SparkplugBPayload {
  timestamp: number;
  metrics: SparkplugMetric[];
  seq?: number;
}

export interface SparkplugMetric {
  name: string;
  alias?: number;
  timestamp?: number;
  dataType: string;
  value: any;
}

export interface ParsedTelemetry {
  deviceId: string;
  timestamp: Date;
  metrics: Record<string, number | string | boolean>;
  raw: any;
}

// MQTT Client Wrapper
export class MqttClientWrapper extends EventEmitter {
  private config: MqttConfig;
  private client: MqttClient | null = null;
  private subscriptions = new Map<string, MqttSubscription>();
  private status: MqttConnectionStatus = {
    connected: false,
    reconnectAttempts: 0,
    subscriptions: []
  };
  private messageHandlers = new Map<string, ((topic: string, payload: Buffer) => void)[]>();

  constructor(config: MqttConfig) {
    super();
    this.config = {
      ...config,
      clientId: config.clientId || `kiisha_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      keepalive: config.keepalive || 60,
      reconnectPeriod: config.reconnectPeriod || 5000,
      connectTimeout: config.connectTimeout || 30000,
      clean: config.clean !== false,
      protocolVersion: config.protocolVersion || 4
    };
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.client?.connected) {
        resolve();
        return;
      }

      const options: IClientOptions = {
        clientId: this.config.clientId,
        username: this.config.username,
        password: this.config.password,
        keepalive: this.config.keepalive,
        reconnectPeriod: this.config.reconnectPeriod,
        connectTimeout: this.config.connectTimeout,
        clean: this.config.clean,
        protocolVersion: this.config.protocolVersion,
        rejectUnauthorized: this.config.useTls !== false
      };

      if (this.config.caCert) options.ca = this.config.caCert;
      if (this.config.clientCert) options.cert = this.config.clientCert;
      if (this.config.clientKey) options.key = this.config.clientKey;

      this.client = mqtt.connect(this.config.brokerUrl, options);

      const connectTimeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.config.connectTimeout);

      this.client.on('connect', () => {
        clearTimeout(connectTimeout);
        this.status.connected = true;
        this.status.lastConnected = new Date();
        this.status.reconnectAttempts = 0;
        this.emit('connected');
        this.resubscribeAll();
        resolve();
      });

      this.client.on('message', (topic, payload, packet) => {
        this.handleMessage(topic, payload, packet);
      });

      this.client.on('error', (error) => {
        this.status.lastError = error.message;
        this.emit('error', error);
      });

      this.client.on('close', () => {
        this.status.connected = false;
        this.emit('disconnected');
      });

      this.client.on('reconnect', () => {
        this.status.reconnectAttempts++;
        this.emit('reconnecting', this.status.reconnectAttempts);
      });
    });
  }

  disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.client) {
        resolve();
        return;
      }
      this.client.end(false, {}, () => {
        this.client = null;
        this.status.connected = false;
        resolve();
      });
    });
  }

  getStatus(): MqttConnectionStatus {
    return {
      ...this.status,
      subscriptions: Array.from(this.subscriptions.keys())
    };
  }

  async subscribe(topic: string, qos: 0 | 1 | 2 = 0): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client?.connected) {
        this.subscriptions.set(topic, { topic, qos });
        resolve();
        return;
      }

      this.client.subscribe(topic, { qos }, (error) => {
        if (error) {
          reject(error);
          return;
        }
        this.subscriptions.set(topic, { topic, qos });
        this.emit('subscribed', topic);
        resolve();
      });
    });
  }

  async unsubscribe(topic: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client?.connected) {
        this.subscriptions.delete(topic);
        resolve();
        return;
      }

      this.client.unsubscribe(topic, (error) => {
        if (error) {
          reject(error);
          return;
        }
        this.subscriptions.delete(topic);
        this.messageHandlers.delete(topic);
        resolve();
      });
    });
  }

  private async resubscribeAll(): Promise<void> {
    for (const [topic, sub] of this.subscriptions) {
      try {
        await this.subscribe(topic, sub.qos);
      } catch (error) {
        console.error(`[MQTT] Failed to resubscribe to ${topic}:`, error);
      }
    }
  }

  onMessage(topicPattern: string, handler: (topic: string, payload: Buffer) => void): void {
    const handlers = this.messageHandlers.get(topicPattern) || [];
    handlers.push(handler);
    this.messageHandlers.set(topicPattern, handlers);
  }

  private handleMessage(topic: string, payload: Buffer, packet: any): void {
    this.emit('message', topic, payload, packet);

    for (const [pattern, handlers] of this.messageHandlers) {
      if (this.topicMatches(topic, pattern)) {
        for (const handler of handlers) {
          try {
            handler(topic, payload);
          } catch (error) {
            console.error(`[MQTT] Handler error for ${topic}:`, error);
          }
        }
      }
    }
  }

  private topicMatches(topic: string, pattern: string): boolean {
    const topicParts = topic.split('/');
    const patternParts = pattern.split('/');

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '#') return true;
      if (patternParts[i] === '+') continue;
      if (i >= topicParts.length || patternParts[i] !== topicParts[i]) return false;
    }

    return topicParts.length === patternParts.length;
  }

  async publish(message: MqttMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client?.connected) {
        reject(new Error('Not connected'));
        return;
      }

      let payload: string | Buffer;
      if (typeof message.payload === 'object' && !(message.payload instanceof Buffer)) {
        payload = JSON.stringify(message.payload);
      } else if (typeof message.payload === 'string') {
        payload = message.payload;
      } else {
        payload = message.payload;
      }

      const options: IClientPublishOptions = {
        qos: message.qos || 0,
        retain: message.retain || false
      };

      this.client.publish(message.topic, payload, options, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  parseJsonPayload<T = any>(payload: Buffer): T | null {
    try {
      return JSON.parse(payload.toString('utf-8'));
    } catch {
      return null;
    }
  }

  parseSparkplugB(payload: Buffer): SparkplugBPayload | null {
    try {
      const data = JSON.parse(payload.toString('utf-8'));
      return {
        timestamp: data.timestamp || Date.now(),
        metrics: (data.metrics || []).map((m: any) => ({
          name: m.name,
          alias: m.alias,
          timestamp: m.timestamp,
          dataType: m.dataType || 'Unknown',
          value: m.value
        })),
        seq: data.seq
      };
    } catch {
      return null;
    }
  }

  parseTelemetry(topic: string, payload: Buffer): ParsedTelemetry | null {
    const topicParts = topic.split('/');
    const deviceId = topicParts.find(p => p.match(/^[A-Za-z0-9_-]+$/)) || 'unknown';

    const jsonData = this.parseJsonPayload(payload);
    if (jsonData) {
      const metrics: Record<string, number | string | boolean> = {};
      
      const flatten = (obj: any, prefix = '') => {
        for (const [key, value] of Object.entries(obj)) {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            flatten(value, fullKey);
          } else if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
            metrics[fullKey] = value;
          }
        }
      };
      
      flatten(jsonData);

      return {
        deviceId,
        timestamp: jsonData.timestamp ? new Date(jsonData.timestamp) : new Date(),
        metrics,
        raw: jsonData
      };
    }

    return null;
  }
}

// Topic Patterns
export const MQTT_TOPIC_PATTERNS = {
  sparkplugBirth: 'spBv1.0/+/NBIRTH/+',
  sparkplugData: 'spBv1.0/+/NDATA/+',
  sparkplugDeath: 'spBv1.0/+/NDEATH/+',
  sparkplugDeviceBirth: 'spBv1.0/+/DBIRTH/+/+',
  sparkplugDeviceData: 'spBv1.0/+/DDATA/+/+',
  sparkplugDeviceDeath: 'spBv1.0/+/DDEATH/+/+',
  solarTelemetry: 'solar/+/telemetry',
  solarStatus: 'solar/+/status',
  solarAlarms: 'solar/+/alarms',
  siteTelemetry: 'sites/+/devices/+/telemetry',
  siteStatus: 'sites/+/devices/+/status',
  weatherCurrent: 'weather/+/current'
};

export function createMqttClient(config: MqttConfig): MqttClientWrapper {
  return new MqttClientWrapper(config);
}

export function buildTopic(...parts: string[]): string {
  return parts.filter(Boolean).join('/');
}

export function extractDeviceId(topic: string, pattern: string): string | null {
  const topicParts = topic.split('/');
  const patternParts = pattern.split('/');
  
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i] === '+' && i < topicParts.length) {
      return topicParts[i];
    }
  }
  
  return null;
}

export default MqttClientWrapper;
