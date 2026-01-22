import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { 
  inverterVendors, inverterConnections, inverterDevices, inverterTelemetry 
} from "../../drizzle/schema";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";

/**
 * Inverter Connector Interfaces
 */
interface InverterCredentials {
  apiKey?: string;
  apiSecret?: string;
  username?: string;
  password?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  plantId?: string;
  stationCode?: string;
}

interface TelemetryData {
  timestamp: Date;
  activePowerKw?: number;
  reactivePowerKvar?: number;
  apparentPowerKva?: number;
  powerFactor?: number;
  dailyEnergyKwh?: number;
  totalEnergyKwh?: number;
  dcVoltage?: number;
  dcCurrent?: number;
  acVoltage?: number;
  acCurrent?: number;
  frequency?: number;
  irradiance?: number;
  moduleTemperature?: number;
  ambientTemperature?: number;
  operatingStatus?: string;
  alarmCodes?: string[];
  rawData?: Record<string, unknown>;
}

/**
 * Base Inverter Connector Interface
 */
interface InverterConnector {
  vendorCode: string;
  authenticate(credentials: InverterCredentials): Promise<{ accessToken: string; expiresAt?: Date }>;
  refreshToken(credentials: InverterCredentials): Promise<{ accessToken: string; expiresAt?: Date }>;
  getDevices(credentials: InverterCredentials): Promise<Array<{
    vendorDeviceId: string;
    serialNumber?: string;
    model?: string;
    name?: string;
    deviceType: "inverter" | "meter" | "battery" | "weather_station" | "combiner_box" | "other";
    ratedPowerKw?: number;
    latitude?: number;
    longitude?: number;
  }>>;
  getTelemetry(credentials: InverterCredentials, deviceId: string, startTime: Date, endTime: Date): Promise<TelemetryData[]>;
  testConnection(credentials: InverterCredentials): Promise<{ success: boolean; message: string; plantName?: string }>;
}

/**
 * Huawei FusionSolar Connector
 */
class HuaweiConnector implements InverterConnector {
  vendorCode = "huawei";
  private baseUrl = "https://intl.fusionsolar.huawei.com/thirdData";

  async authenticate(credentials: InverterCredentials) {
    const response = await fetch(`${this.baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userName: credentials.username,
        systemCode: credentials.password,
      }),
    });
    
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.failCode || "Authentication failed");
    }
    
    return {
      accessToken: response.headers.get("xsrf-token") || "",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    };
  }

  async refreshToken(credentials: InverterCredentials) {
    return this.authenticate(credentials);
  }

  async getDevices(credentials: InverterCredentials) {
    const auth = await this.authenticate(credentials);
    
    const response = await fetch(`${this.baseUrl}/getDevList`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xsrf-token": auth.accessToken,
      },
      body: JSON.stringify({ stationCodes: credentials.stationCode }),
    });
    
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.failCode || "Failed to get devices");
    }
    
    return (data.data || []).map((device: any) => ({
      vendorDeviceId: device.devId,
      serialNumber: device.esnCode,
      model: device.devTypeId,
      name: device.devName,
      deviceType: this.mapDeviceType(device.devTypeId),
      ratedPowerKw: device.invType ? parseFloat(device.invType) : undefined,
      latitude: device.latitude,
      longitude: device.longitude,
    }));
  }

  async getTelemetry(credentials: InverterCredentials, deviceId: string, startTime: Date, endTime: Date) {
    const auth = await this.authenticate(credentials);
    
    const response = await fetch(`${this.baseUrl}/getDevRealKpi`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xsrf-token": auth.accessToken,
      },
      body: JSON.stringify({
        devIds: deviceId,
        devTypeId: 1, // Inverter
      }),
    });
    
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.failCode || "Failed to get telemetry");
    }
    
    return (data.data || []).map((point: any) => ({
      timestamp: new Date(point.collectTime),
      activePowerKw: point.active_power,
      dailyEnergyKwh: point.day_cap,
      totalEnergyKwh: point.total_cap,
      dcVoltage: point.pv_voltage,
      dcCurrent: point.pv_current,
      acVoltage: point.a_u,
      acCurrent: point.a_i,
      frequency: point.elec_freq,
      moduleTemperature: point.temperature,
      operatingStatus: point.run_state?.toString(),
      rawData: point,
    }));
  }

  async testConnection(credentials: InverterCredentials) {
    try {
      const auth = await this.authenticate(credentials);
      
      const response = await fetch(`${this.baseUrl}/getStationList`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xsrf-token": auth.accessToken,
        },
        body: JSON.stringify({}),
      });
      
      const data = await response.json();
      if (!data.success) {
        return { success: false, message: data.failCode || "Connection failed" };
      }
      
      const plant = data.data?.[0];
      return {
        success: true,
        message: `Connected to ${data.data?.length || 0} plant(s)`,
        plantName: plant?.stationName,
      };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Connection failed" };
    }
  }

  private mapDeviceType(typeId: number): "inverter" | "meter" | "battery" | "weather_station" | "combiner_box" | "other" {
    switch (typeId) {
      case 1: return "inverter";
      case 17: return "meter";
      case 39: return "battery";
      case 47: return "weather_station";
      default: return "other";
    }
  }
}

/**
 * Sungrow iSolarCloud Connector
 */
class SungrowConnector implements InverterConnector {
  vendorCode = "sungrow";
  private baseUrl = "https://gateway.isolarcloud.com.hk/openapi";

  async authenticate(credentials: InverterCredentials) {
    const response = await fetch(`${this.baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appkey: credentials.apiKey,
        user_account: credentials.username,
        user_password: credentials.password,
      }),
    });
    
    const data = await response.json();
    if (data.result_code !== "1") {
      throw new Error(data.result_msg || "Authentication failed");
    }
    
    return {
      accessToken: data.result_data?.token || "",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };
  }

  async refreshToken(credentials: InverterCredentials) {
    return this.authenticate(credentials);
  }

  async getDevices(credentials: InverterCredentials) {
    const auth = await this.authenticate(credentials);
    
    const response = await fetch(`${this.baseUrl}/getDeviceList`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${auth.accessToken}`,
      },
      body: JSON.stringify({
        appkey: credentials.apiKey,
        token: auth.accessToken,
        ps_id: credentials.plantId,
      }),
    });
    
    const data = await response.json();
    if (data.result_code !== "1") {
      throw new Error(data.result_msg || "Failed to get devices");
    }
    
    return (data.result_data?.pageList || []).map((device: any) => ({
      vendorDeviceId: device.device_id,
      serialNumber: device.device_sn,
      model: device.device_model,
      name: device.device_name,
      deviceType: this.mapDeviceType(device.device_type),
      ratedPowerKw: device.device_model_code ? parseFloat(device.device_model_code) / 1000 : undefined,
    }));
  }

  async getTelemetry(credentials: InverterCredentials, deviceId: string, startTime: Date, endTime: Date) {
    const auth = await this.authenticate(credentials);
    
    const response = await fetch(`${this.baseUrl}/getDevicePointMinuteDataList`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${auth.accessToken}`,
      },
      body: JSON.stringify({
        appkey: credentials.apiKey,
        token: auth.accessToken,
        device_id: deviceId,
        start_time_stamp: startTime.getTime(),
        end_time_stamp: endTime.getTime(),
      }),
    });
    
    const data = await response.json();
    if (data.result_code !== "1") {
      throw new Error(data.result_msg || "Failed to get telemetry");
    }
    
    return (data.result_data || []).map((point: any) => ({
      timestamp: new Date(point.time_stamp),
      activePowerKw: point.p_ac,
      dailyEnergyKwh: point.e_today,
      totalEnergyKwh: point.e_total,
      dcVoltage: point.v_pv1,
      dcCurrent: point.i_pv1,
      acVoltage: point.v_ac_r,
      acCurrent: point.i_ac_r,
      frequency: point.fac,
      moduleTemperature: point.temp_inv,
      rawData: point,
    }));
  }

  async testConnection(credentials: InverterCredentials) {
    try {
      const auth = await this.authenticate(credentials);
      
      const response = await fetch(`${this.baseUrl}/getPsList`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${auth.accessToken}`,
        },
        body: JSON.stringify({
          appkey: credentials.apiKey,
          token: auth.accessToken,
        }),
      });
      
      const data = await response.json();
      if (data.result_code !== "1") {
        return { success: false, message: data.result_msg || "Connection failed" };
      }
      
      const plant = data.result_data?.pageList?.[0];
      return {
        success: true,
        message: `Connected to ${data.result_data?.pageList?.length || 0} plant(s)`,
        plantName: plant?.ps_name,
      };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Connection failed" };
    }
  }

  private mapDeviceType(type: number): "inverter" | "meter" | "battery" | "weather_station" | "combiner_box" | "other" {
    switch (type) {
      case 1: return "inverter";
      case 2: return "meter";
      case 14: return "battery";
      case 7: return "weather_station";
      default: return "other";
    }
  }
}

/**
 * SMA Sunny Portal Connector
 */
class SMAConnector implements InverterConnector {
  vendorCode = "sma";
  private baseUrl = "https://www.sunnyportal.com/api";

  async authenticate(credentials: InverterCredentials) {
    const response = await fetch(`${this.baseUrl}/authentication/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: credentials.username,
        password: credentials.password,
      }),
    });
    
    const data = await response.json();
    if (!data.access_token) {
      throw new Error("Authentication failed");
    }
    
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async refreshToken(credentials: InverterCredentials) {
    if (!credentials.refreshToken) {
      return this.authenticate(credentials);
    }
    
    const response = await fetch(`${this.baseUrl}/authentication/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: credentials.refreshToken }),
    });
    
    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async getDevices(credentials: InverterCredentials) {
    const auth = await this.authenticate(credentials);
    
    const response = await fetch(`${this.baseUrl}/plants/${credentials.plantId}/devices`, {
      headers: { "Authorization": `Bearer ${auth.accessToken}` },
    });
    
    const data = await response.json();
    
    return (data || []).map((device: any) => ({
      vendorDeviceId: device.deviceId,
      serialNumber: device.serialNumber,
      model: device.productName,
      name: device.name,
      deviceType: this.mapDeviceType(device.deviceClass),
      ratedPowerKw: device.peakPower ? device.peakPower / 1000 : undefined,
    }));
  }

  async getTelemetry(credentials: InverterCredentials, deviceId: string, startTime: Date, endTime: Date) {
    const auth = await this.authenticate(credentials);
    
    const response = await fetch(
      `${this.baseUrl}/devices/${deviceId}/measurements?` +
      `start=${startTime.toISOString()}&end=${endTime.toISOString()}`,
      { headers: { "Authorization": `Bearer ${auth.accessToken}` } }
    );
    
    const data = await response.json();
    
    return (data.measurements || []).map((point: any) => ({
      timestamp: new Date(point.timestamp),
      activePowerKw: point.activePower,
      dailyEnergyKwh: point.dailyYield,
      totalEnergyKwh: point.totalYield,
      dcVoltage: point.dcVoltage,
      dcCurrent: point.dcCurrent,
      acVoltage: point.acVoltage,
      acCurrent: point.acCurrent,
      frequency: point.gridFrequency,
      moduleTemperature: point.moduleTemperature,
      rawData: point,
    }));
  }

  async testConnection(credentials: InverterCredentials) {
    try {
      const auth = await this.authenticate(credentials);
      
      const response = await fetch(`${this.baseUrl}/plants`, {
        headers: { "Authorization": `Bearer ${auth.accessToken}` },
      });
      
      const data = await response.json();
      const plant = data?.[0];
      
      return {
        success: true,
        message: `Connected to ${data?.length || 0} plant(s)`,
        plantName: plant?.name,
      };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Connection failed" };
    }
  }

  private mapDeviceType(deviceClass: string): "inverter" | "meter" | "battery" | "weather_station" | "combiner_box" | "other" {
    switch (deviceClass?.toLowerCase()) {
      case "inverter": return "inverter";
      case "meter": return "meter";
      case "battery": return "battery";
      case "sensor": return "weather_station";
      default: return "other";
    }
  }
}

/**
 * Connector Factory
 */
function getConnector(vendorCode: string): InverterConnector {
  switch (vendorCode) {
    case "huawei": return new HuaweiConnector();
    case "sungrow": return new SungrowConnector();
    case "sma": return new SMAConnector();
    default: throw new Error(`Unsupported vendor: ${vendorCode}`);
  }
}

/**
 * Inverter Connectors Router
 */
export const inverterConnectorsRouter = router({
  // Get all supported vendors
  getVendors: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    
    return db.select().from(inverterVendors).orderBy(inverterVendors.name);
  }),
  
  // List connections for an organization
  listConnections: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const connections = await db.select({
        id: inverterConnections.id,
        name: inverterConnections.name,
        vendorId: inverterConnections.vendorId,
        status: inverterConnections.status,
        lastPolledAt: inverterConnections.lastPolledAt,
        lastError: inverterConnections.lastError,
        totalDataPoints: inverterConnections.totalDataPoints,
        pollingIntervalMinutes: inverterConnections.pollingIntervalMinutes,
        createdAt: inverterConnections.createdAt,
      })
        .from(inverterConnections)
        .where(eq(inverterConnections.organizationId, input.orgId))
        .orderBy(desc(inverterConnections.createdAt));
      
      // Get vendor info
      const vendors = await db.select().from(inverterVendors);
      const vendorMap = Object.fromEntries(vendors.map(v => [v.id, v]));
      
      return connections.map(conn => ({
        ...conn,
        vendor: vendorMap[conn.vendorId],
      }));
    }),
  
  // Create new connection
  createConnection: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      vendorId: z.number(),
      name: z.string().min(1).max(255),
      credentials: z.object({
        apiKey: z.string().optional(),
        apiSecret: z.string().optional(),
        username: z.string().optional(),
        password: z.string().optional(),
        plantId: z.string().optional(),
        stationCode: z.string().optional(),
      }),
      pollingIntervalMinutes: z.number().min(5).max(1440).default(15),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Get vendor
      const [vendor] = await db.select().from(inverterVendors).where(eq(inverterVendors.id, input.vendorId)).limit(1);
      if (!vendor) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vendor not found" });
      }
      
      // Test connection first
      const connector = getConnector(vendor.code);
      const testResult = await connector.testConnection(input.credentials);
      
      if (!testResult.success) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Connection test failed: ${testResult.message}` });
      }
      
      // Create connection
      const result = await db.insert(inverterConnections).values({
        organizationId: input.orgId,
        vendorId: input.vendorId,
        name: input.name,
        credentials: input.credentials,
        pollingIntervalMinutes: input.pollingIntervalMinutes,
        status: "active",
        nextPollAt: new Date(),
        createdBy: ctx.user.id,
      });
      
      return { id: Number(result.insertId), plantName: testResult.plantName, success: true };
    }),
  
  // Test connection
  testConnection: protectedProcedure
    .input(z.object({
      vendorCode: z.string(),
      credentials: z.object({
        apiKey: z.string().optional(),
        apiSecret: z.string().optional(),
        username: z.string().optional(),
        password: z.string().optional(),
        plantId: z.string().optional(),
        stationCode: z.string().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      const connector = getConnector(input.vendorCode);
      return connector.testConnection(input.credentials);
    }),
  
  // Sync devices from vendor
  syncDevices: protectedProcedure
    .input(z.object({ connectionId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const [connection] = await db.select()
        .from(inverterConnections)
        .where(eq(inverterConnections.id, input.connectionId))
        .limit(1);
      
      if (!connection) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Connection not found" });
      }
      
      const [vendor] = await db.select()
        .from(inverterVendors)
        .where(eq(inverterVendors.id, connection.vendorId))
        .limit(1);
      
      if (!vendor) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vendor not found" });
      }
      
      const connector = getConnector(vendor.code);
      const credentials = connection.credentials as InverterCredentials;
      const devices = await connector.getDevices(credentials);
      
      let created = 0;
      let updated = 0;
      
      for (const device of devices) {
        const [existing] = await db.select()
          .from(inverterDevices)
          .where(and(
            eq(inverterDevices.connectionId, input.connectionId),
            eq(inverterDevices.vendorDeviceId, device.vendorDeviceId)
          ))
          .limit(1);
        
        if (existing) {
          await db.update(inverterDevices)
            .set({
              serialNumber: device.serialNumber,
              model: device.model,
              name: device.name,
              deviceType: device.deviceType,
              ratedPowerKw: device.ratedPowerKw?.toString(),
              latitude: device.latitude?.toString(),
              longitude: device.longitude?.toString(),
            })
            .where(eq(inverterDevices.id, existing.id));
          updated++;
        } else {
          await db.insert(inverterDevices).values({
            connectionId: input.connectionId,
            vendorDeviceId: device.vendorDeviceId,
            serialNumber: device.serialNumber,
            model: device.model,
            name: device.name,
            deviceType: device.deviceType,
            ratedPowerKw: device.ratedPowerKw?.toString(),
            latitude: device.latitude?.toString(),
            longitude: device.longitude?.toString(),
          });
          created++;
        }
      }
      
      return { created, updated, total: devices.length };
    }),
  
  // Get devices for a connection
  getDevices: protectedProcedure
    .input(z.object({ connectionId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      return db.select()
        .from(inverterDevices)
        .where(eq(inverterDevices.connectionId, input.connectionId))
        .orderBy(inverterDevices.name);
    }),
  
  // Link device to project
  linkDeviceToProject: protectedProcedure
    .input(z.object({
      deviceId: z.number(),
      projectId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      await db.update(inverterDevices)
        .set({ projectId: input.projectId })
        .where(eq(inverterDevices.id, input.deviceId));
      
      return { success: true };
    }),
  
  // Poll telemetry for a connection
  pollTelemetry: protectedProcedure
    .input(z.object({ connectionId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const [connection] = await db.select()
        .from(inverterConnections)
        .where(eq(inverterConnections.id, input.connectionId))
        .limit(1);
      
      if (!connection) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Connection not found" });
      }
      
      const [vendor] = await db.select()
        .from(inverterVendors)
        .where(eq(inverterVendors.id, connection.vendorId))
        .limit(1);
      
      if (!vendor) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vendor not found" });
      }
      
      const devices = await db.select()
        .from(inverterDevices)
        .where(eq(inverterDevices.connectionId, input.connectionId));
      
      const connector = getConnector(vendor.code);
      const credentials = connection.credentials as InverterCredentials;
      
      const endTime = new Date();
      const startTime = connection.lastPolledAt || new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
      
      let totalPoints = 0;
      
      try {
        for (const device of devices) {
          const telemetry = await connector.getTelemetry(credentials, device.vendorDeviceId, startTime, endTime);
          
          for (const point of telemetry) {
            await db.insert(inverterTelemetry).values({
              deviceId: device.id,
              connectionId: input.connectionId,
              timestamp: point.timestamp,
              activePowerKw: point.activePowerKw?.toString(),
              reactivePowerKvar: point.reactivePowerKvar?.toString(),
              apparentPowerKva: point.apparentPowerKva?.toString(),
              powerFactor: point.powerFactor?.toString(),
              dailyEnergyKwh: point.dailyEnergyKwh?.toString(),
              totalEnergyKwh: point.totalEnergyKwh?.toString(),
              dcVoltage: point.dcVoltage?.toString(),
              dcCurrent: point.dcCurrent?.toString(),
              acVoltage: point.acVoltage?.toString(),
              acCurrent: point.acCurrent?.toString(),
              frequency: point.frequency?.toString(),
              irradiance: point.irradiance?.toString(),
              moduleTemperature: point.moduleTemperature?.toString(),
              ambientTemperature: point.ambientTemperature?.toString(),
              operatingStatus: point.operatingStatus,
              alarmCodes: point.alarmCodes,
              rawData: point.rawData,
            });
            totalPoints++;
          }
          
          // Update device status
          const latestPoint = telemetry[telemetry.length - 1];
          if (latestPoint) {
            await db.update(inverterDevices)
              .set({
                status: latestPoint.operatingStatus === "1" ? "online" : "offline",
                lastStatusUpdate: new Date(),
              })
              .where(eq(inverterDevices.id, device.id));
          }
        }
        
        // Update connection status
        await db.update(inverterConnections)
          .set({
            lastPolledAt: new Date(),
            lastSuccessfulPoll: new Date(),
            nextPollAt: new Date(Date.now() + (connection.pollingIntervalMinutes || 15) * 60 * 1000),
            consecutiveErrors: 0,
            totalDataPoints: (connection.totalDataPoints || 0) + totalPoints,
          })
          .where(eq(inverterConnections.id, input.connectionId));
        
        return { success: true, pointsCollected: totalPoints };
      } catch (error) {
        // Update connection with error
        await db.update(inverterConnections)
          .set({
            lastPolledAt: new Date(),
            lastError: error instanceof Error ? error.message : "Unknown error",
            lastErrorAt: new Date(),
            consecutiveErrors: (connection.consecutiveErrors || 0) + 1,
            status: (connection.consecutiveErrors || 0) >= 2 ? "error" : connection.status,
          })
          .where(eq(inverterConnections.id, input.connectionId));
        
        throw new TRPCError({ 
          code: "INTERNAL_SERVER_ERROR", 
          message: error instanceof Error ? error.message : "Failed to poll telemetry" 
        });
      }
    }),
  
  // Get telemetry data for a device
  getTelemetry: protectedProcedure
    .input(z.object({
      deviceId: z.number(),
      startTime: z.string(),
      endTime: z.string(),
      limit: z.number().min(1).max(10000).default(1000),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      return db.select()
        .from(inverterTelemetry)
        .where(and(
          eq(inverterTelemetry.deviceId, input.deviceId),
          gte(inverterTelemetry.timestamp, new Date(input.startTime)),
          lte(inverterTelemetry.timestamp, new Date(input.endTime))
        ))
        .orderBy(desc(inverterTelemetry.timestamp))
        .limit(input.limit);
    }),
  
  // Delete connection
  deleteConnection: protectedProcedure
    .input(z.object({ connectionId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Delete telemetry
      await db.delete(inverterTelemetry).where(eq(inverterTelemetry.connectionId, input.connectionId));
      
      // Delete devices
      await db.delete(inverterDevices).where(eq(inverterDevices.connectionId, input.connectionId));
      
      // Delete connection
      await db.delete(inverterConnections).where(eq(inverterConnections.id, input.connectionId));
      
      return { success: true };
    }),
});
