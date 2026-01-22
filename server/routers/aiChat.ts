/**
 * AI Chat Router
 * 
 * Handles AI chat functionality for the global chat bubble.
 * Fetches real project data to provide context-aware responses.
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { invokeLLM } from '../_core/llm';
import * as db from '../db';

const messageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

/**
 * Build a data context string from the user's projects and documents
 */
async function buildDataContext(userId: number, orgId: number): Promise<string> {
  const contextParts: string[] = [];

  try {
    // Get user's projects
    const projects = await db.getProjectsForUser(userId);
    
    if (projects.length > 0) {
      contextParts.push('## User Projects');
      contextParts.push(`Total projects: ${projects.length}`);
      contextParts.push('');
      
      for (const project of projects.slice(0, 10)) { // Limit to 10 projects for context size
        contextParts.push(`### ${project.name} (ID: ${project.id})`);
        contextParts.push(`- Code: ${project.code || 'N/A'}`);
        contextParts.push(`- Location: ${project.location || 'N/A'}`);
        contextParts.push(`- Stage: ${project.stage || 'N/A'}`);
        contextParts.push(`- Status: ${project.status || 'N/A'}`);
        if (project.capacityMw) {
          contextParts.push(`- Capacity: ${project.capacityMw} MW`);
        }
        if (project.technologyType) {
          contextParts.push(`- Technology: ${project.technologyType}`);
        }
        
        // Get documents for this project
        const documents = await db.getDocumentsByProject(project.id, false);
        if (documents.length > 0) {
          const verified = documents.filter(d => d.status === 'verified').length;
          const pending = documents.filter(d => d.status === 'pending').length;
          const missing = documents.filter(d => d.status === 'missing').length;
          contextParts.push(`- Documents: ${documents.length} total (${verified} verified, ${pending} pending, ${missing} missing)`);
        }
        
        // Get VATR assets for this project
        const vatrAssets = await db.getVatrAssetsByProject(project.id);
        if (vatrAssets.length > 0) {
          contextParts.push(`- VATR Assets: ${vatrAssets.length}`);
          for (const asset of vatrAssets.slice(0, 3)) {
            contextParts.push(`  - ${asset.assetName}: ${asset.assetClassification || 'N/A'}, ${asset.capacityMw || 'N/A'} MW`);
            if (asset.identityCluster) {
              try {
                const identity = typeof asset.identityCluster === 'string' 
                  ? JSON.parse(asset.identityCluster) 
                  : asset.identityCluster;
                if (identity.cod) contextParts.push(`    - COD: ${identity.cod}`);
                if (identity.ppaCounterparty) contextParts.push(`    - PPA Counterparty: ${identity.ppaCounterparty}`);
              } catch (e) {
                // Skip if can't parse
              }
            }
            if (asset.technicalCluster) {
              try {
                const technical = typeof asset.technicalCluster === 'string' 
                  ? JSON.parse(asset.technicalCluster) 
                  : asset.technicalCluster;
                if (technical.panelCount) contextParts.push(`    - Panel Count: ${technical.panelCount}`);
                if (technical.inverterCount) contextParts.push(`    - Inverter Count: ${technical.inverterCount}`);
                if (technical.degradationRate) contextParts.push(`    - Degradation Rate: ${technical.degradationRate}%`);
              } catch (e) {
                // Skip if can't parse
              }
            }
            if (asset.financialCluster) {
              try {
                const financial = typeof asset.financialCluster === 'string' 
                  ? JSON.parse(asset.financialCluster) 
                  : asset.financialCluster;
                if (financial.ppaRate) contextParts.push(`    - PPA Rate: $${financial.ppaRate}/kWh`);
                if (financial.annualRevenue) contextParts.push(`    - Annual Revenue: $${financial.annualRevenue.toLocaleString()}`);
              } catch (e) {
                // Skip if can't parse
              }
            }
          }
        }
        
        contextParts.push('');
      }
    }

    // Get organization-level stats
    const allProjects = await db.getProjectsByOrganization(orgId);
    if (allProjects.length > 0) {
      contextParts.push('## Portfolio Summary');
      contextParts.push(`- Total Projects in Organization: ${allProjects.length}`);
      
      // Calculate total capacity
      const totalCapacity = allProjects.reduce((sum, p) => sum + (Number(p.capacityMw) || 0), 0);
      contextParts.push(`- Total Portfolio Capacity: ${totalCapacity.toFixed(2)} MW`);
      
      // Count by stage
      const stageCount: Record<string, number> = {};
      allProjects.forEach(p => {
        const stage = p.stage || 'Unknown';
        stageCount[stage] = (stageCount[stage] || 0) + 1;
      });
      contextParts.push('- Projects by Stage:');
      Object.entries(stageCount).forEach(([stage, count]) => {
        contextParts.push(`  - ${stage}: ${count}`);
      });
      
      contextParts.push('');
    }

    // Get RFIs/action items
    const rfis = await db.getRfisForUser(userId);
    if (rfis.length > 0) {
      const openRfis = rfis.filter(r => r.status === 'open').length;
      const inProgressRfis = rfis.filter(r => r.status === 'in_progress').length;
      contextParts.push('## Action Items (RFIs)');
      contextParts.push(`- Total RFIs: ${rfis.length}`);
      contextParts.push(`- Open: ${openRfis}`);
      contextParts.push(`- In Progress: ${inProgressRfis}`);
      contextParts.push('');
    }

    // Get compliance alerts
    const complianceAlerts = await db.getComplianceAlerts(orgId);
    if (complianceAlerts.length > 0) {
      const activeAlerts = complianceAlerts.filter(a => a.status === 'active').length;
      contextParts.push('## Compliance Alerts');
      contextParts.push(`- Total Alerts: ${complianceAlerts.length}`);
      contextParts.push(`- Active Alerts: ${activeAlerts}`);
      contextParts.push('');
    }

  } catch (error) {
    console.error('[AI Chat] Error building data context:', error);
    contextParts.push('Note: Some data could not be loaded.');
  }

  return contextParts.join('\n');
}

const SYSTEM_PROMPT_TEMPLATE = `You are KIISHA AI, an intelligent assistant for the KIISHA solar project management platform.

You have access to the user's real project data, which is provided below. Use this data to answer specific questions with actual numbers and details.

You help users with:
- Understanding their solar project portfolio and documents
- Navigating the platform features (Documents, Workspace, Operations, Financial Models, etc.)
- Answering questions about solar energy projects, permits, interconnection, and technical specifications
- Providing insights from VATR (Valuation, Acquisition, Technical Review) data
- Explaining document statuses and reviewer approvals
- Helping with diligence templates and compliance requirements

Be specific and use the actual data provided. If asked about numbers, capacities, or specific details, reference the real data.
If you don't have specific data for a question, say so and suggest where the user might find it in the platform.

---

# USER'S DATA CONTEXT

{{DATA_CONTEXT}}

---

Remember to be concise, helpful, and professional. Reference specific project names, numbers, and details when answering questions.`;

export const aiChatRouter = router({
  /**
   * Send a chat message and get an AI response with real data context
   */
  chat: protectedProcedure
    .input(z.object({
      messages: z.array(messageSchema),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Build data context from user's real data
        const dataContext = await buildDataContext(ctx.user.id, ctx.user.activeOrgId || 1);
        
        // Create the system prompt with real data
        const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace('{{DATA_CONTEXT}}', dataContext);
        
        // Prepare messages - replace the first system message with our enhanced one
        const llmMessages = input.messages.map((m, index) => {
          if (index === 0 && m.role === 'system') {
            return {
              role: 'system' as const,
              content: systemPrompt,
            };
          }
          return {
            role: m.role as 'system' | 'user' | 'assistant',
            content: m.content,
          };
        });

        // If no system message exists, prepend one
        if (llmMessages.length === 0 || llmMessages[0].role !== 'system') {
          llmMessages.unshift({
            role: 'system' as const,
            content: systemPrompt,
          });
        }

        // Invoke the LLM
        const response = await invokeLLM({
          messages: llmMessages,
        });

        // Extract the response content
        const assistantMessage = response.choices[0]?.message;
        if (!assistantMessage) {
          throw new Error('No response from AI');
        }

        // Handle content that might be an array
        let content: string;
        if (typeof assistantMessage.content === 'string') {
          content = assistantMessage.content;
        } else if (Array.isArray(assistantMessage.content)) {
          content = assistantMessage.content
            .filter(part => part.type === 'text')
            .map(part => (part as { type: 'text'; text: string }).text)
            .join('\n');
        } else {
          content = 'I apologize, but I was unable to generate a response.';
        }

        return {
          role: 'assistant' as const,
          content,
        };
      } catch (error) {
        console.error('[AI Chat] Error:', error);
        throw error;
      }
    }),

  /**
   * Get a summary of the user's data for debugging/display
   */
  getDataSummary: protectedProcedure
    .query(async ({ ctx }) => {
      const dataContext = await buildDataContext(ctx.user.id, ctx.user.activeOrgId || 1);
      return {
        context: dataContext,
        userId: ctx.user.id,
        orgId: ctx.user.activeOrgId || 1,
      };
    }),
});
