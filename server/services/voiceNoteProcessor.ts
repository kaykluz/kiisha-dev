/**
 * Voice Note Processor Service
 * 
 * Handles WhatsApp voice note detection, transcription,
 * and automatic document creation from voice messages.
 */

import { transcribeAudio } from '../_core/voiceTranscription';
import { invokeLLM } from '../_core/llm';
import * as db from '../db';

// =============================================================================
// TYPES
// =============================================================================

export interface VoiceNoteResult {
  success: boolean;
  transcription?: string;
  language?: string;
  duration?: number;
  documentId?: number;
  actionItems?: ActionItem[];
  entities?: ExtractedEntity[];
  summary?: string;
  errors: string[];
}

export interface ActionItem {
  description: string;
  assignee?: string;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'completed';
}

export interface ExtractedEntity {
  type: 'project' | 'asset' | 'person' | 'organization' | 'date' | 'amount';
  value: string;
  confidence: number;
}

// =============================================================================
// VOICE NOTE DETECTION
// =============================================================================

/**
 * Check if a message is a voice note
 */
export function isVoiceNote(mimeType: string | undefined): boolean {
  if (!mimeType) return false;
  
  const voiceTypes = [
    'audio/ogg',
    'audio/opus',
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/webm',
    'audio/amr',
    'audio/3gpp',
  ];
  
  return voiceTypes.some(type => mimeType.toLowerCase().startsWith(type));
}

/**
 * Check if a file is within size limits for transcription
 */
export function isWithinSizeLimit(sizeBytes: number): boolean {
  const MAX_SIZE = 16 * 1024 * 1024; // 16MB
  return sizeBytes <= MAX_SIZE;
}

// =============================================================================
// TRANSCRIPTION
// =============================================================================

/**
 * Transcribe a voice note from URL
 */
export async function transcribeVoiceNote(
  audioUrl: string,
  options: {
    language?: string;
    prompt?: string;
  } = {}
): Promise<{
  text: string;
  language: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}> {
  const result = await transcribeAudio({
    audioUrl,
    language: options.language,
    prompt: options.prompt || 'Transcribe this voice message about solar energy projects, assets, and operations.',
  });
  
  // Handle potential error response
  if ('error' in result) {
    return {
      text: '',
      language: 'en',
      segments: [],
    };
  }
  
  return {
    text: result.text || '',
    language: result.language || 'en',
    segments: (result as any).segments?.map((s: any) => ({
      start: s.start,
      end: s.end,
      text: s.text,
    })) || [],
  };
}

// =============================================================================
// AI ANALYSIS
// =============================================================================

/**
 * Extract action items and entities from transcription
 */
export async function analyzeTranscription(
  transcription: string,
  context?: {
    projectName?: string;
    senderName?: string;
  }
): Promise<{
  summary: string;
  actionItems: ActionItem[];
  entities: ExtractedEntity[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
  topics: string[];
}> {
  const contextInfo = context 
    ? `Context: Project "${context.projectName || 'Unknown'}", Sender: ${context.senderName || 'Unknown'}`
    : '';
  
  const response = await invokeLLM({
    messages: [
      {
        role: 'system',
        content: `You are an assistant analyzing voice note transcriptions from a solar asset management system.

Extract:
1. A brief summary (1-2 sentences)
2. Action items with assignee (if mentioned), due date (if mentioned), and priority
3. Named entities: projects, assets, people, organizations, dates, monetary amounts
4. Overall sentiment: positive, neutral, negative, or urgent
5. Main topics discussed

${contextInfo}

Respond in JSON format.`
      },
      {
        role: 'user',
        content: `Analyze this voice note transcription:\n\n"${transcription}"`
      }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'voice_analysis',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            actionItems: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  description: { type: 'string' },
                  assignee: { type: ['string', 'null'] },
                  dueDate: { type: ['string', 'null'] },
                  priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                  status: { type: 'string', enum: ['pending', 'completed'] }
                },
                required: ['description', 'assignee', 'dueDate', 'priority', 'status'],
                additionalProperties: false
              }
            },
            entities: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['project', 'asset', 'person', 'organization', 'date', 'amount'] },
                  value: { type: 'string' },
                  confidence: { type: 'number' }
                },
                required: ['type', 'value', 'confidence'],
                additionalProperties: false
              }
            },
            sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative', 'urgent'] },
            topics: { type: 'array', items: { type: 'string' } }
          },
          required: ['summary', 'actionItems', 'entities', 'sentiment', 'topics'],
          additionalProperties: false
        }
      }
    }
  });
  
  try {
    const content = response.choices?.[0]?.message?.content;
    if (content && typeof content === 'string') {
      return JSON.parse(content);
    }
  } catch (e) {
    // Fall through to default
  }
  
  return {
    summary: 'Voice note transcription',
    actionItems: [],
    entities: [],
    sentiment: 'neutral',
    topics: []
  };
}

// =============================================================================
// DOCUMENT CREATION
// =============================================================================

/**
 * Create a document record from a voice note transcription
 */
export async function createDocumentFromVoiceNote(
  transcription: string,
  analysis: {
    summary: string;
    actionItems: ActionItem[];
    entities: ExtractedEntity[];
    sentiment: string;
    topics: string[];
  },
  metadata: {
    userId: number;
    organizationId: number | null;
    projectId?: number;
    assetId?: number;
    senderName?: string;
    originalUrl?: string;
    duration?: number;
    language?: string;
  }
): Promise<{ documentId: number; artifactId?: number }> {
  // Create document content
  const content = `# Voice Note Transcription

**Date:** ${new Date().toISOString()}
**Sender:** ${metadata.senderName || 'Unknown'}
**Duration:** ${metadata.duration ? `${Math.round(metadata.duration)}s` : 'Unknown'}
**Language:** ${metadata.language || 'Unknown'}

## Summary
${analysis.summary}

## Full Transcription
${transcription}

## Action Items
${analysis.actionItems.length > 0 
  ? analysis.actionItems.map((item, i) => 
      `${i + 1}. **${item.description}**\n   - Priority: ${item.priority}\n   - Assignee: ${item.assignee || 'Unassigned'}\n   - Due: ${item.dueDate || 'Not specified'}`
    ).join('\n\n')
  : 'No action items identified.'}

## Extracted Entities
${analysis.entities.length > 0
  ? analysis.entities.map(e => `- ${e.type}: ${e.value}`).join('\n')
  : 'No entities extracted.'}

## Topics
${analysis.topics.join(', ') || 'General discussion'}

---
*Automatically transcribed and analyzed by KIISHA*
`;

  // Create the document
  const docResult = await db.createDocument({
    name: `Voice Note - ${new Date().toLocaleDateString()}`,
    notes: analysis.summary,
    projectId: metadata.projectId || 0,
    uploadedById: metadata.userId,
    status: 'pending',
    documentTypeId: 1, // Default type
    fileUrl: metadata.originalUrl || '',
    fileKey: '',
    mimeType: 'text/markdown',
    fileSize: content.length,
  });
  
  const documentId = typeof docResult === 'object' && docResult && 'insertId' in docResult 
    ? Number((docResult as any).insertId) 
    : (typeof docResult === 'number' ? docResult : 0);
  
  // Also create an artifact for the voice note
  let artifactId: number | undefined;
  if (documentId) {
    const artifactResult = await db.createArtifact({
      name: `Voice Note - ${new Date().toLocaleDateString()}`,
      artifactType: 'audio',
      description: analysis.summary,
      originalFileUrl: metadata.originalUrl || '',
      originalFileHash: '',
      projectId: metadata.projectId || null,
      siteId: null,
      assetId: metadata.assetId || null,
      organizationId: metadata.organizationId,
      createdBy: metadata.userId,
    });
    
    artifactId = typeof artifactResult === 'object' && artifactResult && 'id' in artifactResult 
        ? (artifactResult as any).id 
        : 0;
    
    // Create audio-specific record
    if (artifactId) {
      await db.createArtifactAudio({
        artifactId,
        durationSeconds: metadata.duration || 0,
        transcriptText: transcription,
        transcriptConfidence: '0.9000',
        transcriptLanguage: metadata.language || 'en',
        transcriptStatus: 'complete',
        speakerCount: 1,
        noiseReductionApplied: false,
      });
    }
  }
  
  return { documentId, artifactId };
}

// =============================================================================
// MAIN PROCESSING FUNCTION
// =============================================================================

/**
 * Process a voice note from WhatsApp
 */
export async function processVoiceNote(
  audioUrl: string,
  metadata: {
    userId: number;
    organizationId: number | null;
    projectId?: number;
    assetId?: number;
    senderName?: string;
    senderPhone?: string;
    messageId?: string;
    fileSizeBytes?: number;
  }
): Promise<VoiceNoteResult> {
  const result: VoiceNoteResult = {
    success: false,
    errors: []
  };
  
  try {
    // Step 1: Check file size
    if (metadata.fileSizeBytes && !isWithinSizeLimit(metadata.fileSizeBytes)) {
      result.errors.push('Voice note exceeds 16MB size limit');
      return result;
    }
    
    // Step 2: Transcribe
    const transcriptionResult = await transcribeVoiceNote(audioUrl, {
      prompt: metadata.projectId 
        ? 'Transcribe this voice message about solar energy projects, maintenance, and operations.'
        : undefined
    });
    
    result.transcription = transcriptionResult.text;
    result.language = transcriptionResult.language;
    
    if (!result.transcription || result.transcription.trim().length === 0) {
      result.errors.push('Transcription returned empty result');
      return result;
    }
    
    // Step 3: Analyze transcription
    const analysis = await analyzeTranscription(result.transcription, {
      senderName: metadata.senderName
    });
    
    result.summary = analysis.summary;
    result.actionItems = analysis.actionItems;
    result.entities = analysis.entities;
    
    // Step 4: Create document
    const docResult = await createDocumentFromVoiceNote(
      result.transcription,
      analysis,
      {
        userId: metadata.userId,
        organizationId: metadata.organizationId,
        projectId: metadata.projectId,
        assetId: metadata.assetId,
        senderName: metadata.senderName,
        originalUrl: audioUrl,
        language: result.language
      }
    );
    
    result.documentId = docResult.documentId;
    result.success = true;
    
    // Step 5: Create action items as tasks if any
    if (analysis.actionItems.length > 0 && metadata.projectId) {
      for (const item of analysis.actionItems) {
        // Could create work orders or tasks here
        // For now, they're captured in the document
      }
    }
    
    return result;
    
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return result;
  }
}

// =============================================================================
// INTEGRATION WITH CONVERSATIONAL AGENT
// =============================================================================

/**
 * Handle voice note in conversational agent flow
 */
export async function handleVoiceNoteMessage(
  audioUrl: string,
  mimeType: string,
  context: {
    userId: number;
    organizationId: number | null;
    sessionId: string;
    senderName?: string;
    lastReferencedProjectId?: number | null;
    lastReferencedAssetId?: number | null;
  }
): Promise<{
  success: boolean;
  message: string;
  documentId?: number;
  transcription?: string;
  actionItems?: ActionItem[];
}> {
  // Check if it's a voice note
  if (!isVoiceNote(mimeType)) {
    return {
      success: false,
      message: 'This does not appear to be a voice note.'
    };
  }
  
  // Process the voice note
  const result = await processVoiceNote(audioUrl, {
    userId: context.userId,
    organizationId: context.organizationId,
    projectId: context.lastReferencedProjectId || undefined,
    assetId: context.lastReferencedAssetId || undefined,
    senderName: context.senderName
  });
  
  if (!result.success) {
    return {
      success: false,
      message: `Failed to process voice note: ${result.errors.join(', ')}`
    };
  }
  
  // Build response message
  let responseMessage = `🎤 Voice note transcribed and saved!\n\n`;
  
  if (result.summary) {
    responseMessage += `**Summary:** ${result.summary}\n\n`;
  }
  
  if (result.actionItems && result.actionItems.length > 0) {
    responseMessage += `**Action Items Found:**\n`;
    result.actionItems.forEach((item, i) => {
      responseMessage += `${i + 1}. ${item.description} (${item.priority} priority)\n`;
    });
    responseMessage += '\n';
  }
  
  responseMessage += `📄 Document created. Reply "view transcript" to see the full transcription.`;
  
  return {
    success: true,
    message: responseMessage,
    documentId: result.documentId,
    transcription: result.transcription,
    actionItems: result.actionItems
  };
}
