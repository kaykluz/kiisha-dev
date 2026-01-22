import { invokeLLM } from "../_core/llm";

/**
 * AI-powered document analysis for compliance requirements
 */
export async function analyzeDocument(params: {
  documentUrl: string;
  fileName: string;
  mimeType: string;
  requirementTitle: string;
  requirementDescription: string;
}): Promise<{
  isCompliant: boolean;
  confidence: number;
  extractedData: Record<string, string>;
  issues: string[];
  suggestions: string[];
}> {
  const systemPrompt = `You are a compliance document analyst for KIISHA, a platform for managing due diligence and compliance workflows.

Your task is to analyze uploaded documents against specific compliance requirements and determine:
1. Whether the document satisfies the requirement
2. Key data points that can be extracted
3. Any issues or gaps in the document
4. Suggestions for improvement

Always respond in JSON format with the following structure:
{
  "isCompliant": boolean,
  "confidence": number (0-100),
  "extractedData": { "key": "value" },
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1", "suggestion2"]
}`;

  const userPrompt = `Analyze this document for the following compliance requirement:

**Requirement:** ${params.requirementTitle}
**Description:** ${params.requirementDescription}
**Document:** ${params.fileName} (${params.mimeType})

Please analyze the document and provide your assessment.`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: [
            { type: "text", text: userPrompt },
            ...(params.mimeType === "application/pdf" ? [{
              type: "file_url" as const,
              file_url: {
                url: params.documentUrl,
                mime_type: "application/pdf" as const
              }
            }] : params.mimeType.startsWith("image/") ? [{
              type: "image_url" as const,
              image_url: {
                url: params.documentUrl,
                detail: "high" as const
              }
            }] : [])
          ]
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "document_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              isCompliant: { type: "boolean", description: "Whether the document satisfies the requirement" },
              confidence: { type: "number", description: "Confidence score 0-100" },
              extractedData: { 
                type: "object", 
                additionalProperties: { type: "string" },
                description: "Key-value pairs of extracted data"
              },
              issues: { 
                type: "array", 
                items: { type: "string" },
                description: "List of issues found"
              },
              suggestions: { 
                type: "array", 
                items: { type: "string" },
                description: "List of suggestions for improvement"
              }
            },
            required: ["isCompliant", "confidence", "extractedData", "issues", "suggestions"],
            additionalProperties: false
          }
        }
      }
    });

    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") {
      return JSON.parse(content);
    }
    
    throw new Error("Unexpected response format");
  } catch (error) {
    console.error("Document analysis failed:", error);
    return {
      isCompliant: false,
      confidence: 0,
      extractedData: {},
      issues: ["Failed to analyze document"],
      suggestions: ["Please try again or contact support"]
    };
  }
}

/**
 * AI-powered suggestion for completing requirements
 */
export async function suggestRequirementCompletion(params: {
  requirementTitle: string;
  requirementDescription: string;
  companyName: string;
  companyType?: string;
  existingDocuments?: Array<{ name: string; type: string }>;
}): Promise<{
  suggestedDocuments: string[];
  preparationSteps: string[];
  commonIssues: string[];
  estimatedTime: string;
}> {
  const systemPrompt = `You are a compliance advisor for KIISHA. Help companies understand what documents they need to prepare for compliance requirements.

Always respond in JSON format with:
{
  "suggestedDocuments": ["doc1", "doc2"],
  "preparationSteps": ["step1", "step2"],
  "commonIssues": ["issue1", "issue2"],
  "estimatedTime": "X hours/days"
}`;

  const userPrompt = `Help ${params.companyName}${params.companyType ? ` (${params.companyType})` : ''} complete this requirement:

**Requirement:** ${params.requirementTitle}
**Description:** ${params.requirementDescription}

${params.existingDocuments?.length ? `Already uploaded documents: ${params.existingDocuments.map(d => d.name).join(', ')}` : 'No documents uploaded yet.'}

What documents should they prepare and what steps should they follow?`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "requirement_suggestion",
          strict: true,
          schema: {
            type: "object",
            properties: {
              suggestedDocuments: { 
                type: "array", 
                items: { type: "string" },
                description: "List of suggested documents to prepare"
              },
              preparationSteps: { 
                type: "array", 
                items: { type: "string" },
                description: "Steps to prepare the documents"
              },
              commonIssues: { 
                type: "array", 
                items: { type: "string" },
                description: "Common issues to avoid"
              },
              estimatedTime: { 
                type: "string",
                description: "Estimated time to complete"
              }
            },
            required: ["suggestedDocuments", "preparationSteps", "commonIssues", "estimatedTime"],
            additionalProperties: false
          }
        }
      }
    });

    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") {
      return JSON.parse(content);
    }
    
    throw new Error("Unexpected response format");
  } catch (error) {
    console.error("Suggestion generation failed:", error);
    return {
      suggestedDocuments: [],
      preparationSteps: [],
      commonIssues: [],
      estimatedTime: "Unknown"
    };
  }
}

/**
 * AI-powered compliance review summary
 */
export async function generateComplianceReview(params: {
  templateName: string;
  companyName: string;
  submissions: Array<{
    requirementTitle: string;
    status: string;
    documentName?: string;
    issues?: string[];
  }>;
}): Promise<{
  overallAssessment: string;
  riskLevel: "low" | "medium" | "high";
  keyFindings: string[];
  recommendations: string[];
  nextSteps: string[];
}> {
  const systemPrompt = `You are a compliance review specialist for KIISHA. Generate comprehensive compliance review summaries.

Always respond in JSON format with:
{
  "overallAssessment": "summary text",
  "riskLevel": "low" | "medium" | "high",
  "keyFindings": ["finding1", "finding2"],
  "recommendations": ["rec1", "rec2"],
  "nextSteps": ["step1", "step2"]
}`;

  const submissionsSummary = params.submissions.map(s => 
    `- ${s.requirementTitle}: ${s.status}${s.documentName ? ` (${s.documentName})` : ''}${s.issues?.length ? ` - Issues: ${s.issues.join(', ')}` : ''}`
  ).join('\n');

  const userPrompt = `Generate a compliance review summary for:

**Template:** ${params.templateName}
**Company:** ${params.companyName}

**Submissions:**
${submissionsSummary}

Provide an overall assessment and recommendations.`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "compliance_review",
          strict: true,
          schema: {
            type: "object",
            properties: {
              overallAssessment: { type: "string", description: "Overall assessment summary" },
              riskLevel: { type: "string", enum: ["low", "medium", "high"], description: "Risk level" },
              keyFindings: { 
                type: "array", 
                items: { type: "string" },
                description: "Key findings from the review"
              },
              recommendations: { 
                type: "array", 
                items: { type: "string" },
                description: "Recommendations for improvement"
              },
              nextSteps: { 
                type: "array", 
                items: { type: "string" },
                description: "Suggested next steps"
              }
            },
            required: ["overallAssessment", "riskLevel", "keyFindings", "recommendations", "nextSteps"],
            additionalProperties: false
          }
        }
      }
    });

    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") {
      return JSON.parse(content);
    }
    
    throw new Error("Unexpected response format");
  } catch (error) {
    console.error("Compliance review generation failed:", error);
    return {
      overallAssessment: "Unable to generate assessment",
      riskLevel: "medium",
      keyFindings: [],
      recommendations: [],
      nextSteps: []
    };
  }
}

/**
 * AI-powered chat assistant for diligence workflows
 */
export async function chatWithAssistant(params: {
  message: string;
  context: {
    templateName?: string;
    companyName?: string;
    currentRequirement?: string;
    submissionStatus?: string;
  };
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<{
  response: string;
  suggestedActions?: string[];
}> {
  const systemPrompt = `You are KIISHA AI, an intelligent assistant for compliance and due diligence workflows.

You help users:
- Understand compliance requirements
- Prepare necessary documents
- Navigate the diligence process
- Answer questions about regulations and best practices

Be helpful, concise, and professional. If you don't know something, say so.

Current context:
${params.context.templateName ? `- Template: ${params.context.templateName}` : ''}
${params.context.companyName ? `- Company: ${params.context.companyName}` : ''}
${params.context.currentRequirement ? `- Current Requirement: ${params.context.currentRequirement}` : ''}
${params.context.submissionStatus ? `- Status: ${params.context.submissionStatus}` : ''}`;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...(params.conversationHistory || []),
    { role: "user", content: params.message }
  ];

  try {
    const result = await invokeLLM({
      messages: messages as any,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "chat_response",
          strict: true,
          schema: {
            type: "object",
            properties: {
              response: { type: "string", description: "The assistant's response" },
              suggestedActions: { 
                type: "array", 
                items: { type: "string" },
                description: "Optional suggested actions the user can take"
              }
            },
            required: ["response"],
            additionalProperties: false
          }
        }
      }
    });

    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") {
      return JSON.parse(content);
    }
    
    throw new Error("Unexpected response format");
  } catch (error) {
    console.error("Chat assistant failed:", error);
    return {
      response: "I apologize, but I'm having trouble processing your request. Please try again.",
      suggestedActions: []
    };
  }
}
