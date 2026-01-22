/**
 * RFI to Tracker Auto-Conversion Service
 * 
 * Automatically converts RFI templates and responses into
 * due diligence checklist items for tracking.
 */

import { invokeLLM } from '../_core/llm';
import * as db from '../db';

// =============================================================================
// TYPES
// =============================================================================

export interface RfiToTrackerMapping {
  rfiTemplateId: number;
  checklistCategory: string;
  checklistItemTemplate: {
    name: string;
    description: string;
    documentTypes: string[];
    priority: 'high' | 'medium' | 'low';
    estimatedDays?: number;
  };
}

export interface ConversionResult {
  success: boolean;
  checklistId?: number;
  itemsCreated: number;
  itemsPreFilled: number;
  errors: string[];
  mapping: Array<{
    rfiQuestionId: number;
    rfiQuestion: string;
    checklistItemId: number;
    checklistItemName: string;
    preFilled: boolean;
    preFilledValue?: string;
    preFilledSource?: string;
  }>;
}

// =============================================================================
// RFI TEMPLATE TO CHECKLIST MAPPING
// =============================================================================

/**
 * Standard mappings from common RFI question types to checklist categories
 */
const STANDARD_MAPPINGS: Record<string, { category: string; priority: 'high' | 'medium' | 'low' }> = {
  // Legal & Corporate
  'certificate of incorporation': { category: 'Corporate Documents', priority: 'high' },
  'articles of association': { category: 'Corporate Documents', priority: 'high' },
  'shareholder agreement': { category: 'Corporate Documents', priority: 'high' },
  'board resolution': { category: 'Corporate Documents', priority: 'medium' },
  'power of attorney': { category: 'Corporate Documents', priority: 'medium' },
  
  // Financial
  'audited financial statements': { category: 'Financial Documents', priority: 'high' },
  'management accounts': { category: 'Financial Documents', priority: 'medium' },
  'bank statements': { category: 'Financial Documents', priority: 'medium' },
  'tax returns': { category: 'Financial Documents', priority: 'high' },
  'revenue projections': { category: 'Financial Documents', priority: 'medium' },
  
  // Technical
  'technical specifications': { category: 'Technical Documents', priority: 'high' },
  'performance data': { category: 'Technical Documents', priority: 'high' },
  'equipment manuals': { category: 'Technical Documents', priority: 'low' },
  'maintenance records': { category: 'Technical Documents', priority: 'medium' },
  'warranty certificates': { category: 'Technical Documents', priority: 'medium' },
  
  // Permits & Compliance
  'environmental permit': { category: 'Permits & Licenses', priority: 'high' },
  'grid connection agreement': { category: 'Permits & Licenses', priority: 'high' },
  'land lease': { category: 'Permits & Licenses', priority: 'high' },
  'building permit': { category: 'Permits & Licenses', priority: 'high' },
  'operating license': { category: 'Permits & Licenses', priority: 'high' },
  
  // Contracts
  'ppa': { category: 'Commercial Contracts', priority: 'high' },
  'power purchase agreement': { category: 'Commercial Contracts', priority: 'high' },
  'epc contract': { category: 'Commercial Contracts', priority: 'high' },
  'o&m agreement': { category: 'Commercial Contracts', priority: 'high' },
  'insurance policy': { category: 'Commercial Contracts', priority: 'high' },
};

/**
 * Determine checklist category and priority from RFI question text
 */
function mapQuestionToCategory(questionText: string): { category: string; priority: 'high' | 'medium' | 'low' } {
  const lowerText = questionText.toLowerCase();
  
  for (const [keyword, mapping] of Object.entries(STANDARD_MAPPINGS)) {
    if (lowerText.includes(keyword)) {
      return mapping;
    }
  }
  
  // Default category based on keywords
  if (lowerText.includes('financial') || lowerText.includes('revenue') || lowerText.includes('cost')) {
    return { category: 'Financial Documents', priority: 'medium' };
  }
  if (lowerText.includes('technical') || lowerText.includes('specification') || lowerText.includes('performance')) {
    return { category: 'Technical Documents', priority: 'medium' };
  }
  if (lowerText.includes('permit') || lowerText.includes('license') || lowerText.includes('compliance')) {
    return { category: 'Permits & Licenses', priority: 'high' };
  }
  if (lowerText.includes('contract') || lowerText.includes('agreement')) {
    return { category: 'Commercial Contracts', priority: 'medium' };
  }
  
  return { category: 'General Documents', priority: 'medium' };
}

// =============================================================================
// PRE-FILL FROM EXISTING DATA
// =============================================================================

/**
 * Try to pre-fill a checklist item from existing data
 */
async function tryPreFill(
  orgId: number,
  projectId: number | null,
  questionText: string,
  category: string
): Promise<{ value: string; source: string } | null> {
  // Search for existing documents that might answer this question
  const searchTerms = questionText.toLowerCase().split(' ')
    .filter(w => w.length > 3)
    .slice(0, 5);
  
  if (projectId) {
    const docs = await db.getDocumentsByProject(projectId);
    
    for (const doc of docs) {
      const docName = (doc.name || '').toLowerCase();
      const matchCount = searchTerms.filter(term => docName.includes(term)).length;
      
      if (matchCount >= 2 || (matchCount >= 1 && searchTerms.length <= 2)) {
        return {
          value: `Document available: ${doc.name}`,
          source: `document:${doc.id}`
        };
      }
    }
  }
  
  // Check VATR assets for technical data
  if (category === 'Technical Documents' && projectId) {
    const assets = await db.getAssetsByProject(projectId);
    if (assets.length > 0) {
      return {
        value: `${assets.length} asset(s) with technical data available`,
        source: 'vatr_assets'
      };
    }
  }
  
  return null;
}

// =============================================================================
// AI-POWERED QUESTION ANALYSIS
// =============================================================================

/**
 * Use AI to analyze RFI questions and suggest checklist structure
 */
async function aiAnalyzeRfiQuestions(
  questions: Array<{ id: number; text: string; required: boolean }>
): Promise<Array<{
  questionId: number;
  suggestedName: string;
  suggestedCategory: string;
  suggestedPriority: 'high' | 'medium' | 'low';
  documentTypes: string[];
  estimatedDays: number;
}>> {
  const questionList = questions.map((q, i) => 
    `${i + 1}. [ID:${q.id}] ${q.text} (${q.required ? 'Required' : 'Optional'})`
  ).join('\n');
  
  const response = await invokeLLM({
    messages: [
      {
        role: 'system',
        content: `You are a due diligence expert analyzing RFI questions to create a checklist.

For each question, suggest:
- A concise checklist item name (max 50 chars)
- Category: Corporate Documents, Financial Documents, Technical Documents, Permits & Licenses, Commercial Contracts, or General Documents
- Priority: high (critical for deal), medium (important), low (nice to have)
- Document types that would satisfy this (e.g., ["PDF", "Excel", "Certificate"])
- Estimated days to obtain (1-30)

Respond in JSON array format.`
      },
      {
        role: 'user',
        content: `Analyze these RFI questions:\n\n${questionList}`
      }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'rfi_analysis',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  questionId: { type: 'integer' },
                  suggestedName: { type: 'string' },
                  suggestedCategory: { type: 'string' },
                  suggestedPriority: { type: 'string', enum: ['high', 'medium', 'low'] },
                  documentTypes: { type: 'array', items: { type: 'string' } },
                  estimatedDays: { type: 'integer' }
                },
                required: ['questionId', 'suggestedName', 'suggestedCategory', 'suggestedPriority', 'documentTypes', 'estimatedDays'],
                additionalProperties: false
              }
            }
          },
          required: ['items'],
          additionalProperties: false
        }
      }
    }
  });
  
  try {
    const content = response.choices?.[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      return parsed.items || [];
    }
  } catch (e) {
    // Fall through to default
  }
  
  // Fallback: use rule-based mapping
  return questions.map(q => {
    const mapping = mapQuestionToCategory(q.text);
    return {
      questionId: q.id,
      suggestedName: q.text.substring(0, 50),
      suggestedCategory: mapping.category,
      suggestedPriority: q.required ? 'high' : mapping.priority,
      documentTypes: ['PDF', 'Document'],
      estimatedDays: q.required ? 7 : 14
    };
  });
}

// =============================================================================
// MAIN CONVERSION FUNCTION
// =============================================================================

/**
 * Convert an RFI to a due diligence checklist
 */
export async function convertRfiToChecklist(
  rfiId: number,
  userId: number,
  options: {
    checklistName?: string;
    projectId?: number;
    autoPreFill?: boolean;
    useAiAnalysis?: boolean;
  } = {}
): Promise<ConversionResult> {
  const result: ConversionResult = {
    success: false,
    itemsCreated: 0,
    itemsPreFilled: 0,
    errors: [],
    mapping: []
  };
  
  try {
    // Step 1: Load the RFI
    const rfi = await db.getRfiById(rfiId);
    if (!rfi) {
      result.errors.push('RFI not found');
      return result;
    }
    
    // Step 2: Get RFI questions/requirements
    const rfiQuestions = await db.getRfiChecklistItems(rfiId);
    if (!rfiQuestions || rfiQuestions.length === 0) {
      result.errors.push('RFI has no questions/requirements');
      return result;
    }
    
    // Step 3: Analyze questions (AI or rule-based)
    const questions = rfiQuestions.map(q => ({
      id: q.id,
      text: q.description || q.name || '',
      required: q.isRequired || false
    }));
    
    let analysis: Array<{
      questionId: number;
      suggestedName: string;
      suggestedCategory: string;
      suggestedPriority: 'high' | 'medium' | 'low';
      documentTypes: string[];
      estimatedDays: number;
    }>;
    
    if (options.useAiAnalysis !== false) {
      analysis = await aiAnalyzeRfiQuestions(questions);
    } else {
      analysis = questions.map(q => {
        const mapping = mapQuestionToCategory(q.text);
        return {
          questionId: q.id,
          suggestedName: q.text.substring(0, 50),
          suggestedCategory: mapping.category,
          suggestedPriority: q.required ? 'high' : mapping.priority,
          documentTypes: ['PDF'],
          estimatedDays: 7
        };
      });
    }
    
    // Step 4: Create the checklist
    const checklistName = options.checklistName || `DD Tracker - ${rfi.title || `RFI ${rfiId}`}`;
    const projectId = options.projectId || rfi.projectId;
    
    const checklistResult = await db.createChecklist({
      name: checklistName,
      projectId: projectId || 0,
      status: 'in_progress',
      createdBy: userId,
    });
    
    if (!checklistResult) {
      result.errors.push('Failed to create checklist');
      return result;
    }
    
    const checklistId = Number(checklistResult.insertId);
    result.checklistId = checklistId;
    
    // Step 5: Create checklist items from analysis
    for (const item of analysis) {
      const originalQuestion = questions.find(q => q.id === item.questionId);
      if (!originalQuestion) continue;
      
      // Try to pre-fill if enabled
      let preFillResult: { value: string; source: string } | null = null;
      if (options.autoPreFill !== false && projectId) {
        // Get organization ID from project if not available on RFI
        const project = await db.getProjectById(projectId);
        const orgId = project?.organizationId || 0;
        preFillResult = await tryPreFill(
          orgId,
          projectId,
          originalQuestion.text,
          item.suggestedCategory
        );
      }
      
      // Create the checklist item
      const itemResult = await db.createChecklistItem({
        checklistId,
        name: item.suggestedName,
        description: originalQuestion.text,
        category: item.suggestedCategory,
        status: preFillResult ? 'in_progress' : 'not_started',
        priority: item.suggestedPriority,
        assignedTo: null,
        dueDate: new Date(Date.now() + item.estimatedDays * 24 * 60 * 60 * 1000),
        notes: preFillResult ? `Pre-filled: ${preFillResult.value}` : null,
        sortOrder: result.itemsCreated,
      });
      
      if (itemResult) {
        const checklistItemId = Number(itemResult.insertId);
        
        // Link back to RFI question
        await db.createRfiChecklistLink({
          rfiId,
          checklistItemId,
          rfiQuestionId: item.questionId,
        });
        
        result.itemsCreated++;
        if (preFillResult) {
          result.itemsPreFilled++;
        }
        
        result.mapping.push({
          rfiQuestionId: item.questionId,
          rfiQuestion: originalQuestion.text,
          checklistItemId,
          checklistItemName: item.suggestedName,
          preFilled: !!preFillResult,
          preFilledValue: preFillResult?.value,
          preFilledSource: preFillResult?.source
        });
      }
    }
    
    result.success = true;
    return result;
    
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return result;
  }
}

// =============================================================================
// BULK CONVERSION
// =============================================================================

/**
 * Convert multiple RFIs to checklists
 */
export async function bulkConvertRfisToChecklists(
  rfiIds: number[],
  userId: number,
  options: {
    projectId?: number;
    autoPreFill?: boolean;
    useAiAnalysis?: boolean;
  } = {}
): Promise<{
  totalRfis: number;
  successfulConversions: number;
  totalItemsCreated: number;
  totalItemsPreFilled: number;
  results: ConversionResult[];
}> {
  const results: ConversionResult[] = [];
  let totalItemsCreated = 0;
  let totalItemsPreFilled = 0;
  let successfulConversions = 0;
  
  for (const rfiId of rfiIds) {
    const result = await convertRfiToChecklist(rfiId, userId, options);
    results.push(result);
    
    if (result.success) {
      successfulConversions++;
      totalItemsCreated += result.itemsCreated;
      totalItemsPreFilled += result.itemsPreFilled;
    }
  }
  
  return {
    totalRfis: rfiIds.length,
    successfulConversions,
    totalItemsCreated,
    totalItemsPreFilled,
    results
  };
}

// =============================================================================
// PROGRESS SYNC
// =============================================================================

/**
 * Sync progress between RFI and its linked checklist
 */
export async function syncRfiChecklistProgress(rfiId: number): Promise<{
  rfiProgress: number;
  checklistProgress: number;
  itemsCompleted: number;
  totalItems: number;
}> {
  // Get linked checklist items
  const links = await db.getRfiChecklistLinks(rfiId);
  if (!links || links.length === 0) {
    return { rfiProgress: 0, checklistProgress: 0, itemsCompleted: 0, totalItems: 0 };
  }
  
  // Get checklist item statuses
  let completed = 0;
  for (const link of links) {
    const item = await db.getClosingChecklistItem(link.checklistItemId);
    if (item && item.status === 'completed') {
      completed++;
    }
  }
  
  const progress = Math.round((completed / links.length) * 100);
  
  // Update RFI progress
  await db.updateRfiProgress(rfiId, progress);
  
  return {
    rfiProgress: progress,
    checklistProgress: progress,
    itemsCompleted: completed,
    totalItems: links.length
  };
}
