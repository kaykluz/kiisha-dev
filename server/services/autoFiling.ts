/**
 * Auto-Filing Service
 * 
 * Automatically files incoming messages and attachments to the correct
 * assets, projects, and documents based on:
 * - Explicit references in message text
 * - Fuzzy matching of asset/project names
 * - Contextual inference from conversation history
 * - AI-powered entity extraction
 */

import { invokeLLM } from '../_core/llm';
import * as db from '../db';

// =============================================================================
// TYPES
// =============================================================================

export interface AutoFilingResult {
  filed: boolean;
  confidence: number; // 0-1
  matchType: 'explicit' | 'fuzzy' | 'contextual' | 'ai_inferred' | 'none';
  linkedEntities: {
    projectId?: number;
    projectName?: string;
    siteId?: number;
    siteName?: string;
    assetId?: number;
    assetName?: string;
    documentId?: number;
    documentName?: string;
  };
  suggestedLinks?: Array<{
    entityType: 'project' | 'site' | 'asset' | 'document';
    entityId: number;
    entityName: string;
    confidence: number;
    reason: string;
  }>;
  requiresConfirmation: boolean;
  confirmationPrompt?: string;
}

export interface MessageContext {
  userId: number;
  organizationId: number | null;
  channel: 'whatsapp' | 'email' | 'web_chat';
  messageText?: string;
  attachmentFilename?: string;
  attachmentMimeType?: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  lastReferencedProjectId?: number | null;
  lastReferencedSiteId?: number | null;
  lastReferencedAssetId?: number | null;
}

// =============================================================================
// EXPLICIT REFERENCE EXTRACTION
// =============================================================================

/**
 * Extract explicit entity references from message text
 * Looks for patterns like:
 * - "for project X"
 * - "at site Y"
 * - "asset Z"
 * - "document ABC"
 * - Serial numbers, project codes, etc.
 */
export async function extractExplicitReferences(
  text: string,
  orgId: number | null
): Promise<{
  projectRefs: string[];
  siteRefs: string[];
  assetRefs: string[];
  documentRefs: string[];
  serialNumbers: string[];
  projectCodes: string[];
}> {
  const result = {
    projectRefs: [] as string[],
    siteRefs: [] as string[],
    assetRefs: [] as string[],
    documentRefs: [] as string[],
    serialNumbers: [] as string[],
    projectCodes: [] as string[],
  };
  
  if (!text) return result;
  
  const lowerText = text.toLowerCase();
  
  // Pattern: "for project X" or "project: X" or "re: project X"
  const projectPatterns = [
    /(?:for|at|re:|regarding|about|project[:\s]+)([a-z0-9\s\-_]+?)(?:\s+(?:site|asset|document|please|thanks|regarding)|[,.\n]|$)/gi,
    /project\s+(?:name|code)?[:\s]*["']?([^"'\n,]+)["']?/gi,
  ];
  
  for (const pattern of projectPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const ref = match[1].trim();
      if (ref.length >= 3 && ref.length <= 100) {
        result.projectRefs.push(ref);
      }
    }
  }
  
  // Pattern: "site X" or "at site X"
  const sitePatterns = [
    /(?:site|location)[:\s]+["']?([^"'\n,]+)["']?/gi,
    /(?:at|for)\s+site\s+["']?([^"'\n,]+)["']?/gi,
  ];
  
  for (const pattern of sitePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const ref = match[1].trim();
      if (ref.length >= 2 && ref.length <= 100) {
        result.siteRefs.push(ref);
      }
    }
  }
  
  // Pattern: "asset X" or "inverter X" or "panel X"
  const assetPatterns = [
    /(?:asset|inverter|panel|meter|battery|transformer)[:\s]+["']?([^"'\n,]+)["']?/gi,
    /(?:for|about)\s+(?:the\s+)?(?:asset|inverter|panel)\s+["']?([^"'\n,]+)["']?/gi,
  ];
  
  for (const pattern of assetPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const ref = match[1].trim();
      if (ref.length >= 2 && ref.length <= 100) {
        result.assetRefs.push(ref);
      }
    }
  }
  
  // Pattern: Serial numbers (common formats)
  const serialPatterns = [
    /(?:serial|s\/n|sn)[:\s#]*([A-Z0-9\-]{6,30})/gi,
    /\b([A-Z]{2,4}[0-9]{6,12})\b/g, // Common inverter serial format
    /\b([0-9]{10,15})\b/g, // Numeric serial
  ];
  
  for (const pattern of serialPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      result.serialNumbers.push(match[1]);
    }
  }
  
  // Pattern: Project codes (e.g., PRJ-001, SOLAR-2024-001)
  const codePatterns = [
    /\b(PRJ[-_]?[0-9]{3,6})\b/gi,
    /\b(SOLAR[-_]?[0-9]{4}[-_]?[0-9]{3})\b/gi,
    /\b([A-Z]{2,5}[-_][0-9]{3,6})\b/g,
  ];
  
  for (const pattern of codePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      result.projectCodes.push(match[1]);
    }
  }
  
  return result;
}

// =============================================================================
// FUZZY MATCHING
// =============================================================================

/**
 * Calculate similarity between two strings using Levenshtein distance
 */
function levenshteinSimilarity(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  
  if (aLower === bLower) return 1;
  if (aLower.length === 0 || bLower.length === 0) return 0;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= bLower.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= aLower.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= bLower.length; i++) {
    for (let j = 1; j <= aLower.length; j++) {
      if (bLower.charAt(i - 1) === aLower.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  const distance = matrix[bLower.length][aLower.length];
  const maxLen = Math.max(aLower.length, bLower.length);
  return 1 - distance / maxLen;
}

/**
 * Check if string contains all words from query
 */
function containsAllWords(text: string, query: string): boolean {
  const textLower = text.toLowerCase();
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  return queryWords.every(word => textLower.includes(word));
}

/**
 * Find best matching entity from a list using fuzzy matching
 */
export function findBestMatch<T extends { id: number; name: string }>(
  query: string,
  entities: T[],
  threshold: number = 0.6
): { entity: T; similarity: number } | null {
  if (!query || entities.length === 0) return null;
  
  let bestMatch: T | null = null;
  let bestSimilarity = 0;
  
  for (const entity of entities) {
    // Check exact match first
    if (entity.name.toLowerCase() === query.toLowerCase()) {
      return { entity, similarity: 1 };
    }
    
    // Check if query contains all words
    if (containsAllWords(entity.name, query)) {
      const similarity = 0.9;
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = entity;
      }
      continue;
    }
    
    // Levenshtein similarity
    const similarity = levenshteinSimilarity(query, entity.name);
    if (similarity > bestSimilarity && similarity >= threshold) {
      bestSimilarity = similarity;
      bestMatch = entity;
    }
  }
  
  return bestMatch ? { entity: bestMatch, similarity: bestSimilarity } : null;
}

// =============================================================================
// AI-POWERED ENTITY EXTRACTION
// =============================================================================

/**
 * Use LLM to extract entity references from complex messages
 */
export async function aiExtractEntities(
  messageText: string,
  attachmentFilename: string | undefined,
  availableProjects: Array<{ id: number; name: string }>,
  availableSites: Array<{ id: number; name: string }>,
  availableAssets: Array<{ id: number; name: string; serialNumber?: string }>
): Promise<{
  projectId?: number;
  siteId?: number;
  assetId?: number;
  confidence: number;
  reasoning: string;
}> {
  const projectList = availableProjects.slice(0, 20).map(p => `- ${p.name} (ID: ${p.id})`).join('\n');
  const siteList = availableSites.slice(0, 20).map(s => `- ${s.name} (ID: ${s.id})`).join('\n');
  const assetList = availableAssets.slice(0, 30).map(a => 
    `- ${a.name}${a.serialNumber ? ` (S/N: ${a.serialNumber})` : ''} (ID: ${a.id})`
  ).join('\n');
  
  const response = await invokeLLM({
    messages: [
      {
        role: 'system',
        content: `You are an entity extraction assistant for a solar asset management system.
        
Given a message and optional attachment filename, identify which project, site, or asset is being referenced.

Available Projects:
${projectList || 'None'}

Available Sites:
${siteList || 'None'}

Available Assets:
${assetList || 'None'}

Respond in JSON format:
{
  "projectId": <number or null>,
  "siteId": <number or null>,
  "assetId": <number or null>,
  "confidence": <0-1>,
  "reasoning": "<brief explanation>"
}

Rules:
- Only return IDs from the available lists
- If no clear match, return null for that field
- Confidence should reflect how certain you are
- Consider context clues like location names, serial numbers, project codes`
      },
      {
        role: 'user',
        content: `Message: "${messageText || '(no text)'}"
Attachment: "${attachmentFilename || '(none)'}"`
      }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'entity_extraction',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            projectId: { type: ['integer', 'null'] },
            siteId: { type: ['integer', 'null'] },
            assetId: { type: ['integer', 'null'] },
            confidence: { type: 'number' },
            reasoning: { type: 'string' }
          },
          required: ['projectId', 'siteId', 'assetId', 'confidence', 'reasoning'],
          additionalProperties: false
        }
      }
    }
  });
  
  try {
    const content = response.choices?.[0]?.message?.content;
    if (content) {
      return JSON.parse(content);
    }
  } catch (e) {
    // Fall through to default
  }
  
  return { confidence: 0, reasoning: 'Failed to parse AI response' };
}

// =============================================================================
// MAIN AUTO-FILING FUNCTION
// =============================================================================

/**
 * Automatically determine where to file an incoming message/attachment
 */
export async function autoFileMessage(
  context: MessageContext
): Promise<AutoFilingResult> {
  const result: AutoFilingResult = {
    filed: false,
    confidence: 0,
    matchType: 'none',
    linkedEntities: {},
    suggestedLinks: [],
    requiresConfirmation: true,
  };
  
  // Step 1: Extract explicit references from message text
  const explicitRefs = await extractExplicitReferences(
    context.messageText || '',
    context.organizationId
  );
  
  // Step 2: Load available entities for matching
  const projects = context.organizationId 
    ? await db.getProjectsByOrganization(context.organizationId)
    : [];
  const sites = context.organizationId
    ? await db.getSitesByOrganization(context.organizationId)
    : [];
  const assets = context.organizationId
    ? await db.getAssetsByOrganization(context.organizationId)
    : [];
  
  // Step 3: Try explicit matching first (highest confidence)
  for (const ref of explicitRefs.projectRefs) {
    const match = findBestMatch(ref, projects.map(p => ({ id: p.id, name: p.name || '' })));
    if (match && match.similarity >= 0.8) {
      result.linkedEntities.projectId = match.entity.id;
      result.linkedEntities.projectName = match.entity.name;
      result.confidence = match.similarity;
      result.matchType = 'explicit';
      result.filed = true;
      result.requiresConfirmation = match.similarity < 0.95;
      break;
    }
  }
  
  // Try serial number matching for assets
  for (const serial of explicitRefs.serialNumbers) {
    const matchingAsset = assets.find(a => 
      (a as any).serialNumber?.toLowerCase() === serial.toLowerCase()
    );
    if (matchingAsset) {
      result.linkedEntities.assetId = matchingAsset.id;
      result.linkedEntities.assetName = matchingAsset.name || undefined;
      result.confidence = 0.95;
      result.matchType = 'explicit';
      result.filed = true;
      result.requiresConfirmation = false;
      break;
    }
  }
  
  // Step 4: If no explicit match, try contextual inference
  if (!result.filed && context.lastReferencedProjectId) {
    const project = projects.find(p => p.id === context.lastReferencedProjectId);
    if (project) {
      result.linkedEntities.projectId = project.id;
      result.linkedEntities.projectName = project.name || undefined;
      result.confidence = 0.6;
      result.matchType = 'contextual';
      result.filed = true;
      result.requiresConfirmation = true;
    }
  }
  
  if (!result.filed && context.lastReferencedAssetId) {
    const asset = assets.find(a => a.id === context.lastReferencedAssetId);
    if (asset) {
      result.linkedEntities.assetId = asset.id;
      result.linkedEntities.assetName = asset.name || undefined;
      result.confidence = 0.5;
      result.matchType = 'contextual';
      result.filed = true;
      result.requiresConfirmation = true;
    }
  }
  
  // Step 5: If still no match and we have text, try AI extraction
  if (!result.filed && (context.messageText || context.attachmentFilename)) {
    const aiResult = await aiExtractEntities(
      context.messageText || '',
      context.attachmentFilename,
      projects.map(p => ({ id: p.id, name: p.name || '' })),
      sites.map(s => ({ id: s.id, name: s.name || '' })),
      assets.map(a => ({ id: a.id, name: a.name || '', serialNumber: (a as any).serialNumber }))
    );
    
    if (aiResult.confidence >= 0.5) {
      if (aiResult.projectId) {
        const project = projects.find(p => p.id === aiResult.projectId);
        if (project) {
          result.linkedEntities.projectId = project.id;
          result.linkedEntities.projectName = project.name || undefined;
        }
      }
      if (aiResult.siteId) {
        const site = sites.find(s => s.id === aiResult.siteId);
        if (site) {
          result.linkedEntities.siteId = site.id;
          result.linkedEntities.siteName = site.name || undefined;
        }
      }
      if (aiResult.assetId) {
        const asset = assets.find(a => a.id === aiResult.assetId);
        if (asset) {
          result.linkedEntities.assetId = asset.id;
          result.linkedEntities.assetName = asset.name || undefined;
        }
      }
      
      result.confidence = aiResult.confidence * 0.8; // Discount AI confidence slightly
      result.matchType = 'ai_inferred';
      result.filed = Object.keys(result.linkedEntities).length > 0;
      result.requiresConfirmation = true;
    }
  }
  
  // Step 6: Generate suggested links if no confident match
  if (!result.filed || result.confidence < 0.7) {
    // Suggest recent projects
    const recentProjects = projects.slice(0, 5);
    for (const project of recentProjects) {
      result.suggestedLinks?.push({
        entityType: 'project',
        entityId: project.id,
        entityName: project.name || 'Unknown',
        confidence: 0.3,
        reason: 'Recent project'
      });
    }
  }
  
  // Step 7: Generate confirmation prompt
  if (result.filed && result.requiresConfirmation) {
    const entityDesc = result.linkedEntities.assetName 
      ? `asset "${result.linkedEntities.assetName}"`
      : result.linkedEntities.projectName 
        ? `project "${result.linkedEntities.projectName}"`
        : 'the identified entity';
    
    const confidenceLabel = result.confidence >= 0.8 ? 'high' : 
                            result.confidence >= 0.6 ? 'medium' : 'low';
    
    result.confirmationPrompt = `📎 I suggest filing this to ${entityDesc} (${confidenceLabel} confidence, ${result.matchType} match).\n\nReply "yes" to confirm, "no" to leave unlinked, or specify a different destination.`;
  }
  
  return result;
}

// =============================================================================
// AUTO-FILE AND LINK ATTACHMENT
// =============================================================================

/**
 * Automatically file an attachment and optionally link it
 */
export async function autoFileAttachment(
  ingestedFileId: number,
  context: MessageContext,
  autoLink: boolean = false
): Promise<AutoFilingResult> {
  const result = await autoFileMessage(context);
  
  // If auto-linking is enabled and we have high confidence, link immediately
  if (autoLink && result.filed && result.confidence >= 0.9 && !result.requiresConfirmation) {
    if (result.linkedEntities.projectId) {
      await db.linkIngestedFileToProject(ingestedFileId, result.linkedEntities.projectId);
    }
    if (result.linkedEntities.assetId) {
      await db.linkIngestedFileToAsset(ingestedFileId, result.linkedEntities.assetId);
    }
    result.requiresConfirmation = false;
  }
  
  return result;
}

// =============================================================================
// CONFIRM FILING
// =============================================================================

/**
 * Confirm and execute a filing action
 */
export async function confirmFiling(
  ingestedFileId: number,
  linkedEntities: AutoFilingResult['linkedEntities']
): Promise<{ success: boolean; message: string }> {
  try {
    if (linkedEntities.projectId) {
      await db.linkIngestedFileToProject(ingestedFileId, linkedEntities.projectId);
    }
    if (linkedEntities.assetId) {
      await db.linkIngestedFileToAsset(ingestedFileId, linkedEntities.assetId);
    }
    
    const linkedTo = linkedEntities.assetName || linkedEntities.projectName || 'entity';
    return { 
      success: true, 
      message: `✅ Filed to ${linkedTo} successfully.` 
    };
  } catch (error) {
    return { 
      success: false, 
      message: `Failed to file: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}
