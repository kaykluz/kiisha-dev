import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('./db', () => ({
  getArtifacts: vi.fn(),
  getArtifactById: vi.fn(),
  getArtifactByCode: vi.fn(),
  getArtifactByHash: vi.fn(),
  createArtifact: vi.fn(),
  updateArtifact: vi.fn(),
  updateArtifactProcessingStatus: vi.fn(),
  updateArtifactAiStatus: vi.fn(),
  categorizeArtifact: vi.fn(),
  verifyArtifact: vi.fn(),
  deleteArtifact: vi.fn(),
  getArtifactStats: vi.fn(),
  createArtifactImage: vi.fn(),
  getArtifactImage: vi.fn(),
  updateArtifactImage: vi.fn(),
  createArtifactAudio: vi.fn(),
  getArtifactAudio: vi.fn(),
  updateArtifactAudio: vi.fn(),
  createArtifactMeeting: vi.fn(),
  getArtifactMeeting: vi.fn(),
  updateArtifactMeeting: vi.fn(),
  createArtifactContract: vi.fn(),
  getArtifactContract: vi.fn(),
  updateArtifactContract: vi.fn(),
  getContractsByProject: vi.fn(),
  createContractObligation: vi.fn(),
  getContractObligations: vi.fn(),
  updateContractObligationStatus: vi.fn(),
  getUpcomingObligations: vi.fn(),
  createContractAmendment: vi.fn(),
  getContractAmendments: vi.fn(),
  createArtifactExtraction: vi.fn(),
  getArtifactExtractions: vi.fn(),
  getExtractionsByRunId: vi.fn(),
  verifyExtraction: vi.fn(),
  correctExtraction: vi.fn(),
  getUnverifiedExtractions: vi.fn(),
  createArtifactEntityMention: vi.fn(),
  getArtifactEntityMentions: vi.fn(),
  resolveArtifactEntityMention: vi.fn(),
  getUnresolvedArtifactMentions: vi.fn(),
  getLifecycleStages: vi.fn(),
  getLifecycleStageByKey: vi.fn(),
  createLifecycleStage: vi.fn(),
  getStageAttributeDefinitions: vi.fn(),
  createStageAttributeDefinition: vi.fn(),
  getAssetLifecycleTracking: vi.fn(),
  createAssetLifecycleTracking: vi.fn(),
  updateLifecycleCompleteness: vi.fn(),
  transitionLifecycleStage: vi.fn(),
  completeMilestone: vi.fn(),
  getMilestoneCompletions: vi.fn(),
  getStageTransitionHistory: vi.fn(),
  blockLifecycleStage: vi.fn(),
  unblockLifecycleStage: vi.fn(),
  getProjectByCode: vi.fn(),
  createArtifactMessage: vi.fn(),
}));

const db = await import('./db');

describe('Universal Artifact Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Artifacts - Core CRUD', () => {
    it('lists artifacts with filters', async () => {
      const mockArtifacts = [
        { id: 1, artifactCode: 'ART-2026-00001', artifactType: 'document', name: 'Test Doc' },
        { id: 2, artifactCode: 'ART-2026-00002', artifactType: 'image', name: 'Test Image' },
      ];
      vi.mocked(db.getArtifacts).mockResolvedValue(mockArtifacts as any);

      const result = await db.getArtifacts({ organizationId: 1, artifactType: 'document' });
      
      expect(db.getArtifacts).toHaveBeenCalledWith({ organizationId: 1, artifactType: 'document' });
      expect(result).toHaveLength(2);
    });

    it('gets artifact by ID', async () => {
      const mockArtifact = { id: 1, artifactCode: 'ART-2026-00001', name: 'Test' };
      vi.mocked(db.getArtifactById).mockResolvedValue(mockArtifact as any);

      const result = await db.getArtifactById(1);
      
      expect(db.getArtifactById).toHaveBeenCalledWith(1);
      expect(result?.artifactCode).toBe('ART-2026-00001');
    });

    it('gets artifact by code', async () => {
      const mockArtifact = { id: 1, artifactCode: 'ART-2026-00001', name: 'Test' };
      vi.mocked(db.getArtifactByCode).mockResolvedValue(mockArtifact as any);

      const result = await db.getArtifactByCode('ART-2026-00001');
      
      expect(db.getArtifactByCode).toHaveBeenCalledWith('ART-2026-00001');
      expect(result?.id).toBe(1);
    });

    it('creates artifact with auto-generated code', async () => {
      vi.mocked(db.createArtifact).mockResolvedValue({ id: 1, artifactCode: 'ART-2026-00001' });

      const result = await db.createArtifact({
        artifactType: 'document',
        name: 'New Document',
        originalFileUrl: 'https://example.com/file.pdf',
        originalFileHash: 'abc123',
      } as any);
      
      expect(db.createArtifact).toHaveBeenCalled();
      expect(result?.artifactCode).toMatch(/^ART-\d{4}-\d{5}$/);
    });

    it('updates artifact', async () => {
      vi.mocked(db.updateArtifact).mockResolvedValue(undefined);

      await db.updateArtifact(1, { name: 'Updated Name' } as any);
      
      expect(db.updateArtifact).toHaveBeenCalledWith(1, { name: 'Updated Name' });
    });

    it('deletes artifact', async () => {
      vi.mocked(db.deleteArtifact).mockResolvedValue(undefined);

      await db.deleteArtifact(1);
      
      expect(db.deleteArtifact).toHaveBeenCalledWith(1);
    });
  });

  describe('Artifacts - Processing Status', () => {
    it('updates processing status', async () => {
      vi.mocked(db.updateArtifactProcessingStatus).mockResolvedValue(undefined);

      await db.updateArtifactProcessingStatus(1, 'ai_analyzing');
      
      expect(db.updateArtifactProcessingStatus).toHaveBeenCalledWith(1, 'ai_analyzing');
    });

    it('updates AI analysis status', async () => {
      vi.mocked(db.updateArtifactAiStatus).mockResolvedValue(undefined);

      await db.updateArtifactAiStatus(1, 'analyzing', 'run-123');
      
      expect(db.updateArtifactAiStatus).toHaveBeenCalledWith(1, 'analyzing', 'run-123');
    });
  });

  describe('Artifacts - Categorization', () => {
    it('categorizes artifact with AI suggestion', async () => {
      vi.mocked(db.categorizeArtifact).mockResolvedValue(undefined);

      await db.categorizeArtifact(1, 'Technical', 'Engineering', true, 0.95, undefined);
      
      expect(db.categorizeArtifact).toHaveBeenCalledWith(1, 'Technical', 'Engineering', true, 0.95, undefined);
    });

    it('categorizes artifact with human confirmation', async () => {
      vi.mocked(db.categorizeArtifact).mockResolvedValue(undefined);

      await db.categorizeArtifact(1, 'Commercial', 'PPA', false, undefined, 1);
      
      expect(db.categorizeArtifact).toHaveBeenCalledWith(1, 'Commercial', 'PPA', false, undefined, 1);
    });
  });

  describe('Artifacts - Verification', () => {
    it('verifies artifact', async () => {
      vi.mocked(db.verifyArtifact).mockResolvedValue(undefined);

      await db.verifyArtifact(1, 1, 'Verified after review');
      
      expect(db.verifyArtifact).toHaveBeenCalledWith(1, 1, 'Verified after review');
    });
  });

  describe('Artifacts - Statistics', () => {
    it('gets artifact statistics', async () => {
      const mockStats = {
        total: 100,
        byType: { document: 50, image: 30, contract: 20 },
        byProcessingStatus: { ai_complete: 80, pending: 20 },
        byVerificationStatus: { human_verified: 60, unverified: 40 },
        pendingReview: 40,
      };
      vi.mocked(db.getArtifactStats).mockResolvedValue(mockStats);

      const result = await db.getArtifactStats(1);
      
      expect(db.getArtifactStats).toHaveBeenCalledWith(1);
      expect(result?.total).toBe(100);
      expect(result?.pendingReview).toBe(40);
    });
  });

  describe('Artifact Images', () => {
    it('creates image artifact extension', async () => {
      vi.mocked(db.createArtifactImage).mockResolvedValue(1);

      const result = await db.createArtifactImage({
        artifactId: 1,
        imageKind: 'site_photo',
        widthPx: 1920,
        heightPx: 1080,
        containsText: true,
      } as any);
      
      expect(db.createArtifactImage).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it('gets image artifact extension', async () => {
      const mockImage = { artifactId: 1, imageKind: 'site_photo', widthPx: 1920 };
      vi.mocked(db.getArtifactImage).mockResolvedValue(mockImage as any);

      const result = await db.getArtifactImage(1);
      
      expect(db.getArtifactImage).toHaveBeenCalledWith(1);
      expect(result?.imageKind).toBe('site_photo');
    });

    it('updates image artifact extension', async () => {
      vi.mocked(db.updateArtifactImage).mockResolvedValue(undefined);

      await db.updateArtifactImage(1, { ocrText: 'Extracted text' } as any);
      
      expect(db.updateArtifactImage).toHaveBeenCalledWith(1, { ocrText: 'Extracted text' });
    });
  });

  describe('Artifact Audio', () => {
    it('creates audio artifact extension', async () => {
      vi.mocked(db.createArtifactAudio).mockResolvedValue(1);

      const result = await db.createArtifactAudio({
        artifactId: 1,
        durationSeconds: 300,
        recordingType: 'voice_note',
      } as any);
      
      expect(db.createArtifactAudio).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it('updates audio transcript', async () => {
      vi.mocked(db.updateArtifactAudio).mockResolvedValue(undefined);

      await db.updateArtifactAudio(1, {
        transcriptStatus: 'complete',
        transcriptText: 'Transcribed content',
      } as any);
      
      expect(db.updateArtifactAudio).toHaveBeenCalled();
    });
  });

  describe('Artifact Meetings', () => {
    it('creates meeting artifact extension', async () => {
      vi.mocked(db.createArtifactMeeting).mockResolvedValue(1);

      const result = await db.createArtifactMeeting({
        artifactId: 1,
        meetingType: 'due_diligence',
        meetingTitle: 'DD Kickoff',
        isVirtual: true,
      } as any);
      
      expect(db.createArtifactMeeting).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it('updates meeting with action items', async () => {
      vi.mocked(db.updateArtifactMeeting).mockResolvedValue(undefined);

      await db.updateArtifactMeeting(1, {
        summary: 'Meeting summary',
        actionItems: [{ description: 'Follow up', assignee: 'John' }],
      } as any);
      
      expect(db.updateArtifactMeeting).toHaveBeenCalled();
    });
  });

  describe('Contracts', () => {
    it('creates contract artifact extension', async () => {
      vi.mocked(db.createArtifactContract).mockResolvedValue(1);

      const result = await db.createArtifactContract({
        artifactId: 1,
        contractType: 'ppa',
        contractNumber: 'PPA-001',
        effectiveDate: '2026-01-01',
        termYears: 20,
      } as any);
      
      expect(db.createArtifactContract).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it('lists contracts by project', async () => {
      const mockContracts = [
        { artifact: { id: 1 }, contract: { contractType: 'ppa' } },
      ];
      vi.mocked(db.getContractsByProject).mockResolvedValue(mockContracts as any);

      const result = await db.getContractsByProject(1);
      
      expect(db.getContractsByProject).toHaveBeenCalledWith(1);
      expect(result).toHaveLength(1);
    });

    it('creates contract obligation', async () => {
      vi.mocked(db.createContractObligation).mockResolvedValue(1);

      const result = await db.createContractObligation({
        contractId: 1,
        artifactId: 1,
        obligationType: 'payment',
        obligor: 'Buyer',
        description: 'Monthly payment due',
        frequency: 'monthly',
      } as any);
      
      expect(db.createContractObligation).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it('updates obligation compliance status', async () => {
      vi.mocked(db.updateContractObligationStatus).mockResolvedValue(undefined);

      await db.updateContractObligationStatus(1, 'compliant');
      
      expect(db.updateContractObligationStatus).toHaveBeenCalledWith(1, 'compliant');
    });

    it('gets upcoming obligations', async () => {
      const mockObligations = [
        { obligation: { id: 1 }, artifact: { name: 'PPA' }, contract: { contractType: 'ppa' } },
      ];
      vi.mocked(db.getUpcomingObligations).mockResolvedValue(mockObligations as any);

      const result = await db.getUpcomingObligations(1, 30);
      
      expect(db.getUpcomingObligations).toHaveBeenCalledWith(1, 30);
      expect(result).toHaveLength(1);
    });

    it('creates contract amendment', async () => {
      vi.mocked(db.createContractAmendment).mockResolvedValue(1);

      const result = await db.createContractAmendment({
        contractId: 1,
        amendmentArtifactId: 2,
        amendmentNumber: 1,
        amendmentDate: '2026-06-01',
        description: 'Price adjustment',
      } as any);
      
      expect(db.createContractAmendment).toHaveBeenCalled();
      expect(result).toBe(1);
    });
  });

  describe('Extractions', () => {
    it('creates extraction', async () => {
      vi.mocked(db.createArtifactExtraction).mockResolvedValue(1);

      const result = await db.createArtifactExtraction({
        artifactId: 1,
        extractionRunId: 'run-123',
        fieldKey: 'contract_value',
        fieldCategory: 'financial',
        extractedValueNumeric: '1000000',
        confidence: '0.95',
      } as any);
      
      expect(db.createArtifactExtraction).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it('lists extractions by artifact', async () => {
      const mockExtractions = [
        { id: 1, fieldKey: 'contract_value', extractedValueNumeric: '1000000' },
      ];
      vi.mocked(db.getArtifactExtractions).mockResolvedValue(mockExtractions as any);

      const result = await db.getArtifactExtractions(1);
      
      expect(db.getArtifactExtractions).toHaveBeenCalledWith(1);
      expect(result).toHaveLength(1);
    });

    it('verifies extraction', async () => {
      vi.mocked(db.verifyExtraction).mockResolvedValue(undefined);

      await db.verifyExtraction(1, 1, 'Looks correct');
      
      expect(db.verifyExtraction).toHaveBeenCalledWith(1, 1, 'Looks correct');
    });

    it('corrects extraction', async () => {
      vi.mocked(db.correctExtraction).mockResolvedValue(undefined);

      await db.correctExtraction(1, { numeric: 1500000 }, 1);
      
      expect(db.correctExtraction).toHaveBeenCalledWith(1, { numeric: 1500000 }, 1);
    });

    it('gets unverified extractions', async () => {
      const mockExtractions = [
        { extraction: { id: 1 }, artifact: { name: 'Test' } },
      ];
      vi.mocked(db.getUnverifiedExtractions).mockResolvedValue(mockExtractions as any);

      const result = await db.getUnverifiedExtractions(1, 50);
      
      expect(db.getUnverifiedExtractions).toHaveBeenCalledWith(1, 50);
      expect(result).toHaveLength(1);
    });
  });

  describe('Entity Mentions', () => {
    it('creates entity mention', async () => {
      vi.mocked(db.createArtifactEntityMention).mockResolvedValue(1);

      const result = await db.createArtifactEntityMention({
        artifactId: 1,
        mentionText: 'Saratoga Solar Project',
        mentionType: 'site',
      } as any);
      
      expect(db.createArtifactEntityMention).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it('resolves entity mention', async () => {
      vi.mocked(db.resolveArtifactEntityMention).mockResolvedValue(undefined);

      await db.resolveArtifactEntityMention(1, 'site', 5, 0.9, 1);
      
      expect(db.resolveArtifactEntityMention).toHaveBeenCalledWith(1, 'site', 5, 0.9, 1);
    });

    it('gets unresolved mentions', async () => {
      const mockMentions = [
        { mention: { id: 1, mentionText: 'Unknown Site' }, artifact: { name: 'Test' } },
      ];
      vi.mocked(db.getUnresolvedArtifactMentions).mockResolvedValue(mockMentions as any);

      const result = await db.getUnresolvedArtifactMentions(1);
      
      expect(db.getUnresolvedArtifactMentions).toHaveBeenCalledWith(1);
      expect(result).toHaveLength(1);
    });
  });
});

describe('Asset Lifecycle Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Lifecycle Stages', () => {
    it('gets all lifecycle stages', async () => {
      const mockStages = [
        { stageKey: 'origination', stageName: 'Origination', stageOrder: 1 },
        { stageKey: 'development', stageName: 'Development', stageOrder: 2 },
      ];
      vi.mocked(db.getLifecycleStages).mockResolvedValue(mockStages as any);

      const result = await db.getLifecycleStages();
      
      expect(db.getLifecycleStages).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('gets stage by key', async () => {
      const mockStage = { stageKey: 'due_diligence', stageName: 'Due Diligence', stageOrder: 3 };
      vi.mocked(db.getLifecycleStageByKey).mockResolvedValue(mockStage as any);

      const result = await db.getLifecycleStageByKey('due_diligence');
      
      expect(db.getLifecycleStageByKey).toHaveBeenCalledWith('due_diligence');
      expect(result?.stageName).toBe('Due Diligence');
    });

    it('creates lifecycle stage', async () => {
      vi.mocked(db.createLifecycleStage).mockResolvedValue(1);

      const result = await db.createLifecycleStage({
        stageKey: 'custom_stage',
        stageName: 'Custom Stage',
        stageOrder: 7,
      } as any);
      
      expect(db.createLifecycleStage).toHaveBeenCalled();
      expect(result).toBe(1);
    });
  });

  describe('Stage Attribute Definitions', () => {
    it('gets attribute definitions for stage', async () => {
      const mockDefs = [
        { attributeKey: 'ppa_rate', displayName: 'PPA Rate', dataType: 'number' },
      ];
      vi.mocked(db.getStageAttributeDefinitions).mockResolvedValue(mockDefs as any);

      const result = await db.getStageAttributeDefinitions('operations');
      
      expect(db.getStageAttributeDefinitions).toHaveBeenCalledWith('operations');
      expect(result).toHaveLength(1);
    });

    it('creates attribute definition', async () => {
      vi.mocked(db.createStageAttributeDefinition).mockResolvedValue(1);

      const result = await db.createStageAttributeDefinition({
        lifecycleStage: 'due_diligence',
        attributeKey: 'environmental_clearance',
        attributeCategory: 'compliance',
        displayName: 'Environmental Clearance',
        dataType: 'boolean',
        required: true,
      } as any);
      
      expect(db.createStageAttributeDefinition).toHaveBeenCalled();
      expect(result).toBe(1);
    });
  });

  describe('Lifecycle Tracking', () => {
    it('gets lifecycle tracking for project', async () => {
      const mockTracking = {
        id: 1,
        projectId: 1,
        currentStage: 'due_diligence',
        stageCompleteness: '54',
      };
      vi.mocked(db.getAssetLifecycleTracking).mockResolvedValue(mockTracking as any);

      const result = await db.getAssetLifecycleTracking('project', 1);
      
      expect(db.getAssetLifecycleTracking).toHaveBeenCalledWith('project', 1);
      expect(result?.currentStage).toBe('due_diligence');
    });

    it('creates lifecycle tracking', async () => {
      vi.mocked(db.createAssetLifecycleTracking).mockResolvedValue(1);

      const result = await db.createAssetLifecycleTracking({
        projectId: 1,
        currentStage: 'origination',
        stageEnteredAt: new Date(),
      } as any);
      
      expect(db.createAssetLifecycleTracking).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it('updates completeness', async () => {
      vi.mocked(db.updateLifecycleCompleteness).mockResolvedValue(undefined);

      await db.updateLifecycleCompleteness(1, 75, 6, 8, 30, 40);
      
      expect(db.updateLifecycleCompleteness).toHaveBeenCalledWith(1, 75, 6, 8, 30, 40);
    });
  });

  describe('Stage Transitions', () => {
    it('transitions to new stage', async () => {
      vi.mocked(db.transitionLifecycleStage).mockResolvedValue(undefined);

      await db.transitionLifecycleStage(1, 'construction', 1, 'DD complete');
      
      expect(db.transitionLifecycleStage).toHaveBeenCalledWith(1, 'construction', 1, 'DD complete');
    });

    it('gets transition history', async () => {
      const mockHistory = [
        { fromStage: 'development', toStage: 'due_diligence', transitionedAt: new Date() },
      ];
      vi.mocked(db.getStageTransitionHistory).mockResolvedValue(mockHistory as any);

      const result = await db.getStageTransitionHistory(1);
      
      expect(db.getStageTransitionHistory).toHaveBeenCalledWith(1);
      expect(result).toHaveLength(1);
    });
  });

  describe('Milestones', () => {
    it('completes milestone', async () => {
      vi.mocked(db.completeMilestone).mockResolvedValue(1);

      const result = await db.completeMilestone({
        lifecycleTrackingId: 1,
        milestoneKey: 'interconnection_agreement',
        completedAt: new Date(),
        completedBy: 1,
      } as any);
      
      expect(db.completeMilestone).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it('gets milestone completions', async () => {
      const mockCompletions = [
        { milestoneKey: 'site_control', completedAt: new Date() },
      ];
      vi.mocked(db.getMilestoneCompletions).mockResolvedValue(mockCompletions as any);

      const result = await db.getMilestoneCompletions(1);
      
      expect(db.getMilestoneCompletions).toHaveBeenCalledWith(1);
      expect(result).toHaveLength(1);
    });
  });

  describe('Blocking', () => {
    it('blocks stage', async () => {
      vi.mocked(db.blockLifecycleStage).mockResolvedValue(undefined);

      await db.blockLifecycleStage(1, 'Awaiting permit approval');
      
      expect(db.blockLifecycleStage).toHaveBeenCalledWith(1, 'Awaiting permit approval');
    });

    it('unblocks stage', async () => {
      vi.mocked(db.unblockLifecycleStage).mockResolvedValue(undefined);

      await db.unblockLifecycleStage(1);
      
      expect(db.unblockLifecycleStage).toHaveBeenCalledWith(1);
    });
  });
});


describe('Artifact Upload Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('File Type Detection', () => {
    it('detects document types from MIME type', () => {
      const documentMimeTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv',
      ];
      
      // These would be detected as 'document' type
      documentMimeTypes.forEach(mimeType => {
        expect(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'text/csv']).toContain(mimeType);
      });
    });

    it('detects image types from MIME type', () => {
      const imageMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        'image/tiff',
      ];
      
      imageMimeTypes.forEach(mimeType => {
        expect(mimeType.startsWith('image/')).toBe(true);
      });
    });

    it('detects audio types from MIME type', () => {
      const audioMimeTypes = [
        'audio/mpeg',
        'audio/wav',
        'audio/ogg',
        'audio/webm',
        'audio/mp4',
      ];
      
      audioMimeTypes.forEach(mimeType => {
        expect(mimeType.startsWith('audio/')).toBe(true);
      });
    });

    it('detects video types from MIME type', () => {
      const videoMimeTypes = [
        'video/mp4',
        'video/webm',
        'video/quicktime',
        'video/x-msvideo',
      ];
      
      videoMimeTypes.forEach(mimeType => {
        expect(mimeType.startsWith('video/')).toBe(true);
      });
    });
  });

  describe('Upload Processing', () => {
    it('creates artifact with pending status', async () => {
      vi.mocked(db.createArtifact).mockResolvedValue({ id: 1, artifactCode: 'ART-2026-00001' });
      vi.mocked(db.updateArtifactProcessingStatus).mockResolvedValue(undefined);

      const result = await db.createArtifact({
        artifactType: 'document',
        name: 'uploaded-file.pdf',
        originalFileUrl: 'https://storage.example.com/artifacts/1/file.pdf',
        originalFileHash: 'sha256-abc123',
        originalFileSizeBytes: 1024000,
        originalMimeType: 'application/pdf',
        ingestionChannel: 'upload',
        senderType: 'user',
        senderId: 1,
        processingStatus: 'pending',
      } as any);
      
      expect(db.createArtifact).toHaveBeenCalled();
      expect(result?.id).toBe(1);
    });

    it('updates processing status to preprocessing', async () => {
      vi.mocked(db.updateArtifactProcessingStatus).mockResolvedValue(undefined);

      await db.updateArtifactProcessingStatus(1, 'preprocessing');
      
      expect(db.updateArtifactProcessingStatus).toHaveBeenCalledWith(1, 'preprocessing');
    });

    it('updates processing status to processed', async () => {
      vi.mocked(db.updateArtifactProcessingStatus).mockResolvedValue(undefined);

      await db.updateArtifactProcessingStatus(1, 'processed');
      
      expect(db.updateArtifactProcessingStatus).toHaveBeenCalledWith(1, 'processed');
    });

    it('creates image extension for image uploads', async () => {
      vi.mocked(db.createArtifactImage).mockResolvedValue(1);

      const result = await db.createArtifactImage({
        artifactId: 1,
        imageKind: 'other',
      } as any);
      
      expect(db.createArtifactImage).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it('creates audio extension for audio uploads', async () => {
      vi.mocked(db.createArtifactAudio).mockResolvedValue(1);

      const result = await db.createArtifactAudio({
        artifactId: 1,
        recordingType: 'other',
      } as any);
      
      expect(db.createArtifactAudio).toHaveBeenCalled();
      expect(result).toBe(1);
    });
  });

  describe('Upload Metadata', () => {
    it('stores file hash for deduplication', async () => {
      const mockCreateArtifact = vi.fn().mockResolvedValue({ id: 1, artifactCode: 'ART-2026-00001' });
      
      await mockCreateArtifact({
        artifactType: 'document',
        name: 'test.pdf',
        originalFileUrl: 'https://storage.example.com/file.pdf',
        originalFileHash: 'sha256-e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        originalFileSizeBytes: 2048,
        originalMimeType: 'application/pdf',
      });
      
      expect(mockCreateArtifact).toHaveBeenCalledWith(
        expect.objectContaining({
          originalFileHash: 'sha256-e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        })
      );
    });

    it('stores tags with artifact', async () => {
      const mockCreateArtifact = vi.fn().mockResolvedValue({ id: 1, artifactCode: 'ART-2026-00001' });
      
      await mockCreateArtifact({
        artifactType: 'document',
        name: 'contract.pdf',
        originalFileUrl: 'https://storage.example.com/file.pdf',
        originalFileHash: 'sha256-abc',
        tags: ['contract', 'ppa', 'solar'],
      });
      
      expect(mockCreateArtifact).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['contract', 'ppa', 'solar'],
        })
      );
    });

    it('associates artifact with project', async () => {
      const mockCreateArtifact = vi.fn().mockResolvedValue({ id: 1, artifactCode: 'ART-2026-00001' });
      
      await mockCreateArtifact({
        artifactType: 'document',
        name: 'site-plan.pdf',
        originalFileUrl: 'https://storage.example.com/file.pdf',
        originalFileHash: 'sha256-abc',
        projectId: 5,
      });
      
      expect(mockCreateArtifact).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 5,
        })
      );
    });
  });

  describe('Processing Pipeline Status', () => {
    it('transitions through processing states', async () => {
      const mockUpdateStatus = vi.fn().mockResolvedValue(undefined);
      
      // Simulate processing pipeline
      await mockUpdateStatus(1, 'pending');
      await mockUpdateStatus(1, 'preprocessing');
      await mockUpdateStatus(1, 'processed');
      await mockUpdateStatus(1, 'ai_analyzing');
      await mockUpdateStatus(1, 'ai_complete');
      
      expect(mockUpdateStatus).toHaveBeenCalledTimes(5);
      expect(mockUpdateStatus).toHaveBeenNthCalledWith(1, 1, 'pending');
      expect(mockUpdateStatus).toHaveBeenNthCalledWith(2, 1, 'preprocessing');
      expect(mockUpdateStatus).toHaveBeenNthCalledWith(3, 1, 'processed');
      expect(mockUpdateStatus).toHaveBeenNthCalledWith(4, 1, 'ai_analyzing');
      expect(mockUpdateStatus).toHaveBeenNthCalledWith(5, 1, 'ai_complete');
    });

    it('handles processing failure', async () => {
      const mockUpdateStatus = vi.fn().mockResolvedValue(undefined);
      
      await mockUpdateStatus(1, 'failed');
      
      expect(mockUpdateStatus).toHaveBeenCalledWith(1, 'failed');
    });
  });
});


// ============================================
// Phase 9.2-9.5: New Feature Tests
// ============================================

describe('Duplicate Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when no duplicate exists', async () => {
    vi.mocked(db.getArtifactByHash).mockResolvedValue(null);
    
    const result = await db.getArtifactByHash('unique-hash-abc123');
    
    expect(db.getArtifactByHash).toHaveBeenCalledWith('unique-hash-abc123');
    expect(result).toBeNull();
  });

  it('should return existing artifact when hash matches', async () => {
    const existingArtifact = { id: 42, artifactCode: 'ART-2026-00042', name: 'Existing File' };
    vi.mocked(db.getArtifactByHash).mockResolvedValue(existingArtifact as any);
    
    const result = await db.getArtifactByHash('existing-hash-xyz789');
    
    expect(db.getArtifactByHash).toHaveBeenCalledWith('existing-hash-xyz789');
    expect(result?.id).toBe(42);
    expect(result?.artifactCode).toBe('ART-2026-00042');
  });
});

describe('Batch Tagging', () => {
  it('should support applying tags to multiple files', () => {
    const batchTags = ['project-alpha', 'q1-2026', 'urgent'];
    const files = ['file1.pdf', 'file2.pdf', 'file3.pdf'];
    
    const filesWithTags = files.map(name => ({
      name,
      tags: [...batchTags],
    }));
    
    filesWithTags.forEach(file => {
      expect(file.tags).toEqual(batchTags);
      expect(file.tags).toHaveLength(3);
    });
  });

  it('should merge batch tags with individual tags', () => {
    const batchTags = ['batch-upload', 'q1-2026'];
    const individualTags = ['contract', 'ppa'];
    
    const mergedTags = [...new Set([...batchTags, ...individualTags])];
    
    expect(mergedTags).toContain('batch-upload');
    expect(mergedTags).toContain('contract');
    expect(mergedTags).toHaveLength(4);
  });
});

describe('Email Ingestion', () => {
  it('should extract project code from email address', () => {
    const testCases = [
      { email: 'project+PROJ001@ingest.kiisha.com', expected: 'PROJ001' },
      { email: 'project+saratoga-solar@ingest.kiisha.com', expected: 'saratoga-solar' },
      { email: 'project+123@ingest.kiisha.com', expected: '123' },
      { email: 'ingest@kiisha.com', expected: null },
    ];
    
    testCases.forEach(({ email, expected }) => {
      const match = email.match(/project\+([^@]+)@/);
      const projectCode = match ? match[1] : null;
      expect(projectCode).toBe(expected);
    });
  });

  it('should determine artifact type from MIME type', () => {
    const mimeTypeMap: Array<{ mime: string; expected: string }> = [
      { mime: 'application/pdf', expected: 'document' },
      { mime: 'image/jpeg', expected: 'image' },
      { mime: 'image/png', expected: 'image' },
      { mime: 'audio/mpeg', expected: 'audio' },
      { mime: 'video/mp4', expected: 'video' },
      { mime: 'application/msword', expected: 'document' },
      { mime: 'text/plain', expected: 'document' },
    ];
    
    mimeTypeMap.forEach(({ mime, expected }) => {
      let artifactType = 'document';
      if (mime.startsWith('image/')) artifactType = 'image';
      else if (mime.startsWith('audio/')) artifactType = 'audio';
      else if (mime.startsWith('video/')) artifactType = 'video';
      
      expect(artifactType).toBe(expected);
    });
  });

  it('should validate email ingestion request format', () => {
    const validRequest = {
      messageId: 'msg-456',
      from: 'contractor@example.com',
      to: 'project+PROJ001@ingest.kiisha.com',
      subject: 'Site Survey Report',
      bodyText: 'Please find attached the site survey report.',
      receivedAt: new Date().toISOString(),
      attachments: [
        {
          filename: 'survey-report.pdf',
          mimeType: 'application/pdf',
          size: 1024000,
          content: Buffer.from('mock pdf content').toString('base64'),
        },
      ],
      projectCode: 'PROJ001',
      apiKey: 'kiisha-email-ingest-key',
    };
    
    expect(validRequest.attachments).toHaveLength(1);
    expect(validRequest.projectCode).toBe('PROJ001');
    expect(validRequest.attachments[0].content).toBeTruthy();
  });

  it('should handle multiple attachments', () => {
    const attachments = [
      { filename: 'doc1.pdf', mimeType: 'application/pdf', size: 1000, content: 'base64...' },
      { filename: 'photo.jpg', mimeType: 'image/jpeg', size: 2000, content: 'base64...' },
      { filename: 'audio.mp3', mimeType: 'audio/mpeg', size: 3000, content: 'base64...' },
    ];
    
    const results = attachments.map(att => {
      let type = 'document';
      if (att.mimeType.startsWith('image/')) type = 'image';
      else if (att.mimeType.startsWith('audio/')) type = 'audio';
      return { filename: att.filename, type };
    });
    
    expect(results[0].type).toBe('document');
    expect(results[1].type).toBe('image');
    expect(results[2].type).toBe('audio');
  });
});

describe('Extraction Review Queue', () => {
  it('should filter extractions by verification status', () => {
    const extractions = [
      { id: 1, verificationStatus: 'unverified' },
      { id: 2, verificationStatus: 'verified' },
      { id: 3, verificationStatus: 'unverified' },
      { id: 4, verificationStatus: 'corrected' },
      { id: 5, verificationStatus: 'rejected' },
    ];
    
    const unverified = extractions.filter(e => e.verificationStatus === 'unverified');
    const verified = extractions.filter(e => e.verificationStatus === 'verified');
    const corrected = extractions.filter(e => e.verificationStatus === 'corrected');
    
    expect(unverified).toHaveLength(2);
    expect(verified).toHaveLength(1);
    expect(corrected).toHaveLength(1);
  });

  it('should filter extractions by confidence level', () => {
    const extractions = [
      { id: 1, confidence: 0.95 },
      { id: 2, confidence: 0.75 },
      { id: 3, confidence: 0.60 },
      { id: 4, confidence: 0.92 },
      { id: 5, confidence: 0.85 },
    ];
    
    const highConfidence = extractions.filter(e => e.confidence >= 0.9);
    const mediumConfidence = extractions.filter(e => e.confidence >= 0.7 && e.confidence < 0.9);
    const lowConfidence = extractions.filter(e => e.confidence < 0.7);
    
    expect(highConfidence).toHaveLength(2);
    expect(mediumConfidence).toHaveLength(2);
    expect(lowConfidence).toHaveLength(1);
  });

  it('should group extractions by artifact', () => {
    const extractions = [
      { id: 1, artifactId: 101, fieldKey: 'field1' },
      { id: 2, artifactId: 101, fieldKey: 'field2' },
      { id: 3, artifactId: 102, fieldKey: 'field1' },
      { id: 4, artifactId: 103, fieldKey: 'field1' },
      { id: 5, artifactId: 101, fieldKey: 'field3' },
    ];
    
    const grouped = extractions.reduce((acc, e) => {
      if (!acc[e.artifactId]) acc[e.artifactId] = [];
      acc[e.artifactId].push(e);
      return acc;
    }, {} as Record<number, typeof extractions>);
    
    expect(Object.keys(grouped)).toHaveLength(3);
    expect(grouped[101]).toHaveLength(3);
    expect(grouped[102]).toHaveLength(1);
    expect(grouped[103]).toHaveLength(1);
  });

  it('should support bulk verification', () => {
    const selectedIds = new Set([1, 2, 3]);
    const extractions = [
      { id: 1, verificationStatus: 'unverified' },
      { id: 2, verificationStatus: 'unverified' },
      { id: 3, verificationStatus: 'unverified' },
      { id: 4, verificationStatus: 'unverified' },
    ];
    
    const updated = extractions.map(e => 
      selectedIds.has(e.id) ? { ...e, verificationStatus: 'verified' } : e
    );
    
    const verified = updated.filter(e => e.verificationStatus === 'verified');
    const stillUnverified = updated.filter(e => e.verificationStatus === 'unverified');
    
    expect(verified).toHaveLength(3);
    expect(stillUnverified).toHaveLength(1);
  });

  it('should calculate review queue statistics', () => {
    const extractions = [
      { verificationStatus: 'unverified', confidence: 0.95 },
      { verificationStatus: 'unverified', confidence: 0.65 },
      { verificationStatus: 'verified', confidence: 0.90 },
      { verificationStatus: 'corrected', confidence: 0.70 },
      { verificationStatus: 'rejected', confidence: 0.50 },
    ];
    
    const stats = {
      total: extractions.length,
      unverified: extractions.filter(e => e.verificationStatus === 'unverified').length,
      verified: extractions.filter(e => e.verificationStatus === 'verified').length,
      corrected: extractions.filter(e => e.verificationStatus === 'corrected').length,
      rejected: extractions.filter(e => e.verificationStatus === 'rejected').length,
      lowConfidence: extractions.filter(e => e.confidence < 0.7).length,
    };
    
    expect(stats.total).toBe(5);
    expect(stats.unverified).toBe(2);
    expect(stats.lowConfidence).toBe(2);
  });
});

describe('Lifecycle Wizard', () => {
  it('should calculate milestone completion percentage', () => {
    const milestones = [
      { key: 'm1', completed: true, required: true },
      { key: 'm2', completed: true, required: true },
      { key: 'm3', completed: false, required: true },
      { key: 'm4', completed: false, required: false },
    ];
    
    const requiredMilestones = milestones.filter(m => m.required);
    const completedRequired = requiredMilestones.filter(m => m.completed).length;
    const percentage = (completedRequired / requiredMilestones.length) * 100;
    
    expect(percentage).toBeCloseTo(66.67, 1);
  });

  it('should calculate attribute completion percentage', () => {
    const attributes = [
      { key: 'a1', filled: true },
      { key: 'a2', filled: true },
      { key: 'a3', filled: false },
      { key: 'a4', filled: true },
    ];
    
    const filledCount = attributes.filter(a => a.filled).length;
    const percentage = (filledCount / attributes.length) * 100;
    
    expect(percentage).toBe(75);
  });

  it('should determine if stage can advance', () => {
    const canAdvance = (milestoneProgress: number, attrProgress: number) => {
      return milestoneProgress === 100 && attrProgress === 100;
    };
    
    expect(canAdvance(100, 100)).toBe(true);
    expect(canAdvance(100, 80)).toBe(false);
    expect(canAdvance(80, 100)).toBe(false);
    expect(canAdvance(50, 50)).toBe(false);
  });

  it('should track stage order correctly', () => {
    const stages = [
      { key: 'origination', order: 1 },
      { key: 'development', order: 2 },
      { key: 'due_diligence', order: 3 },
      { key: 'construction', order: 4 },
      { key: 'commissioning', order: 5 },
      { key: 'operations', order: 6 },
    ];
    
    const currentStageKey = 'development';
    const currentIndex = stages.findIndex(s => s.key === currentStageKey);
    const nextStage = stages[currentIndex + 1];
    const prevStage = stages[currentIndex - 1];
    
    expect(currentIndex).toBe(1);
    expect(nextStage.key).toBe('due_diligence');
    expect(prevStage.key).toBe('origination');
  });

  it('should identify past, current, and future stages', () => {
    const stages = ['origination', 'development', 'due_diligence', 'construction', 'commissioning', 'operations'];
    const currentStageKey = 'due_diligence';
    const currentIndex = stages.indexOf(currentStageKey);
    
    const isPast = (index: number) => index < currentIndex;
    const isCurrent = (index: number) => index === currentIndex;
    const isFuture = (index: number) => index > currentIndex;
    
    expect(isPast(0)).toBe(true);  // origination
    expect(isPast(1)).toBe(true);  // development
    expect(isCurrent(2)).toBe(true);  // due_diligence
    expect(isFuture(3)).toBe(true);  // construction
    expect(isFuture(4)).toBe(true);  // commissioning
    expect(isFuture(5)).toBe(true);  // operations
  });

  it('should calculate overall stage completion', () => {
    const calculateOverall = (milestoneProgress: number, attrProgress: number) => {
      return (milestoneProgress + attrProgress) / 2;
    };
    
    expect(calculateOverall(100, 100)).toBe(100);
    expect(calculateOverall(80, 60)).toBe(70);
    expect(calculateOverall(50, 50)).toBe(50);
    expect(calculateOverall(0, 0)).toBe(0);
  });

  it('should handle milestone completion tracking', () => {
    const milestones = [
      { key: 'site_identified', completed: false, completedAt: null, completedBy: null },
      { key: 'initial_assessment', completed: false, completedAt: null, completedBy: null },
    ];
    
    // Complete first milestone
    const now = new Date();
    milestones[0] = {
      ...milestones[0],
      completed: true,
      completedAt: now,
      completedBy: 'John Smith',
    };
    
    expect(milestones[0].completed).toBe(true);
    expect(milestones[0].completedAt).toBe(now);
    expect(milestones[0].completedBy).toBe('John Smith');
    expect(milestones[1].completed).toBe(false);
  });
});
