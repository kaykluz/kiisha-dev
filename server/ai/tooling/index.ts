/**
 * Tool Loader - Initializes all KIISHA AI tools
 * 
 * Import this module to register all tools with the registry.
 */

// Import tool modules to register them
import "./documentTools";
import "./assetTools";
import "./rfiTools";

// Re-export registry functions
export {
  registerTool,
  getTool,
  getAllTools,
  getToolsForRole,
  executeTool,
  getOpenAITools,
  toOpenAIToolFormat,
} from "./registry";

// Export tool names for reference
export { documentToolNames } from "./documentTools";
export { assetToolNames } from "./assetTools";
export { rfiToolNames } from "./rfiTools";

// Get all registered tool names
export function getAllToolNames(): string[] {
  const { getAllTools } = require("./registry");
  return getAllTools().map((t: { name: string }) => t.name);
}

console.log("[AI Tools] All tools registered");
