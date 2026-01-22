import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import * as db from "../db";

// Input schemas
const createCategorySchema = z.object({
  description: z.string().min(10, "Please provide a detailed description"),
  organizationId: z.number().optional(),
});

const createDocumentTypeSchema = z.object({
  categoryId: z.number(),
  description: z.string().min(10, "Please provide a detailed description"),
  organizationId: z.number().optional(),
});

const suggestCategorySchema = z.object({
  description: z.string().min(5, "Please describe the document type"),
});

// AI prompt for category creation
const CATEGORY_CREATION_PROMPT = `You are an expert in renewable energy project documentation and document management systems.

Based on the user's description, create a new document category for a renewable energy asset management platform.

The platform manages documents for solar, wind, and battery storage projects including:
- Financial models and projections
- Energy reports (PVsyst, Homer Pro, etc.)
- Technical designs (SLDs, layouts, 3D models)
- Legal documents (contracts, permits, agreements)
- Compliance documents (certificates, reports)
- Construction documents (drawings, specifications)
- Operations documents (manuals, procedures)

Respond with a JSON object containing:
{
  "name": "Category Name",
  "code": "CATEGORY_CODE",
  "description": "Brief description of what documents belong in this category",
  "icon": "lucide-icon-name",
  "color": "#hexcolor",
  "suggestedTypes": [
    {
      "name": "Document Type Name",
      "code": "DOC_TYPE_CODE",
      "description": "What this document type contains",
      "extractionConfig": {
        "fields": ["field1", "field2"],
        "dateFields": ["date1"],
        "numericFields": ["amount1"]
      }
    }
  ]
}

Use appropriate Lucide icon names like: file-text, file-spreadsheet, file-chart, building, zap, sun, wind, battery, shield, scale, clipboard, folder, etc.
Use professional hex colors that work well on dark backgrounds.`;

const DOCUMENT_TYPE_CREATION_PROMPT = `You are an expert in renewable energy project documentation.

Based on the user's description, create a new document type for the specified category.

Respond with a JSON object containing:
{
  "name": "Document Type Name",
  "code": "DOC_TYPE_CODE",
  "description": "What this document type contains and when it's used",
  "extractionConfig": {
    "fields": ["field1", "field2"],
    "dateFields": ["date1", "date2"],
    "numericFields": ["amount1", "amount2"],
    "keyPhrases": ["phrase to look for"],
    "fileTypes": [".pdf", ".xlsx"]
  },
  "validationRules": {
    "requiredFields": ["field1"],
    "maxFileSize": 50,
    "allowedExtensions": [".pdf", ".xlsx", ".docx"]
  }
}`;

export const documentCategoriesRouter = router({
  // AI-powered category suggestion
  suggestCategory: protectedProcedure
    .input(suggestCategorySchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: CATEGORY_CREATION_PROMPT },
            { role: "user", content: `Create a document category for: ${input.description}` }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "category_suggestion",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  code: { type: "string" },
                  description: { type: "string" },
                  icon: { type: "string" },
                  color: { type: "string" },
                  suggestedTypes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        code: { type: "string" },
                        description: { type: "string" },
                        extractionConfig: {
                          type: "object",
                          properties: {
                            fields: { type: "array", items: { type: "string" } },
                            dateFields: { type: "array", items: { type: "string" } },
                            numericFields: { type: "array", items: { type: "string" } }
                          },
                          required: ["fields", "dateFields", "numericFields"],
                          additionalProperties: false
                        }
                      },
                      required: ["name", "code", "description", "extractionConfig"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["name", "code", "description", "icon", "color", "suggestedTypes"],
                additionalProperties: false
              }
            }
          }
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to generate category suggestion' });
        }

        return JSON.parse(content);
      } catch (error) {
        console.error('AI category suggestion error:', error);
        throw new TRPCError({ 
          code: 'INTERNAL_SERVER_ERROR', 
          message: 'Failed to generate category suggestion' 
        });
      }
    }),

  // Create a new category from AI suggestion or manual input
  createCategory: protectedProcedure
    .input(z.object({
      name: z.string(),
      code: z.string(),
      description: z.string(),
      icon: z.string().optional(),
      color: z.string().optional(),
      organizationId: z.number().optional(),
      isSystem: z.boolean().default(false),
      parentCategoryId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const category = await db.createDocumentCategory({
        name: input.name,
        code: input.code,
        description: input.description,
        icon: input.icon,
        color: input.color,
        organizationId: input.organizationId,
        isSystem: input.isSystem,
        parentCategoryId: input.parentCategoryId,
        createdBy: ctx.user.id,
      });

      return category;
    }),

  // AI-powered document type suggestion
  suggestDocumentType: protectedProcedure
    .input(z.object({
      categoryId: z.number(),
      description: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get category context
      const category = await db.getDocumentCategoryById(input.categoryId);
      
      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: DOCUMENT_TYPE_CREATION_PROMPT },
            { 
              role: "user", 
              content: `Category: ${category?.name || 'Unknown'}\nDescription: ${category?.description || ''}\n\nCreate a document type for: ${input.description}` 
            }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "document_type_suggestion",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  code: { type: "string" },
                  description: { type: "string" },
                  extractionConfig: {
                    type: "object",
                    properties: {
                      fields: { type: "array", items: { type: "string" } },
                      dateFields: { type: "array", items: { type: "string" } },
                      numericFields: { type: "array", items: { type: "string" } },
                      keyPhrases: { type: "array", items: { type: "string" } },
                      fileTypes: { type: "array", items: { type: "string" } }
                    },
                    required: ["fields", "dateFields", "numericFields", "keyPhrases", "fileTypes"],
                    additionalProperties: false
                  },
                  validationRules: {
                    type: "object",
                    properties: {
                      requiredFields: { type: "array", items: { type: "string" } },
                      maxFileSize: { type: "number" },
                      allowedExtensions: { type: "array", items: { type: "string" } }
                    },
                    required: ["requiredFields", "maxFileSize", "allowedExtensions"],
                    additionalProperties: false
                  }
                },
                required: ["name", "code", "description", "extractionConfig", "validationRules"],
                additionalProperties: false
              }
            }
          }
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to generate document type suggestion' });
        }

        return { ...JSON.parse(content), categoryId: input.categoryId };
      } catch (error) {
        console.error('AI document type suggestion error:', error);
        throw new TRPCError({ 
          code: 'INTERNAL_SERVER_ERROR', 
          message: 'Failed to generate document type suggestion' 
        });
      }
    }),

  // Create a new document type from AI suggestion or manual input
  createDocumentType: protectedProcedure
    .input(z.object({
      categoryId: z.number(),
      name: z.string(),
      code: z.string(),
      description: z.string(),
      extractionConfig: z.record(z.unknown()).optional(),
      validationRules: z.record(z.unknown()).optional(),
      aiCreated: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const docType = await db.createDocumentType({
        categoryId: input.categoryId,
        name: input.name,
        code: input.code,
        description: input.description,
        extractionConfig: input.extractionConfig,
        validationRules: input.validationRules,
        aiCreated: input.aiCreated,
        createdBy: ctx.user.id,
      });

      return docType;
    }),

  // List all categories with optional organization filter
  listCategories: protectedProcedure
    .input(z.object({
      organizationId: z.number().optional(),
      includeSystem: z.boolean().default(true),
    }).optional())
    .query(async ({ ctx, input }) => {
      return db.getDocumentCategories({
        organizationId: input?.organizationId,
        includeSystem: input?.includeSystem ?? true,
      });
    }),

  // List document types for a category
  listDocumentTypes: protectedProcedure
    .input(z.object({
      categoryId: z.number().optional(),
      organizationId: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return db.getDocumentTypes({
        categoryId: input?.categoryId,
        organizationId: input?.organizationId,
      });
    }),

  // Update a category
  updateCategory: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
      color: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return db.updateDocumentCategory(id, data);
    }),

  // Update a document type
  updateDocumentType: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      extractionConfig: z.record(z.unknown()).optional(),
      validationRules: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return db.updateDocumentType(id, data);
    }),

  // Delete a category (soft delete by setting status)
  deleteCategory: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Check if category has documents
      const hasDocuments = await db.categoryHasDocuments(input.id);
      if (hasDocuments) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot delete category with existing documents. Move or delete documents first.',
        });
      }
      
      return db.deleteDocumentCategory(input.id);
    }),

  // Delete a document type
  deleteDocumentType: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Check if document type has documents
      const hasDocuments = await db.documentTypeHasDocuments(input.id);
      if (hasDocuments) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot delete document type with existing documents. Move or delete documents first.',
        });
      }
      
      return db.deleteDocumentType(input.id);
    }),
});
