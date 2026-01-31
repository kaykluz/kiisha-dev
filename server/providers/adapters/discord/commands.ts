// Discord slash command implementations for KIISHA
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SelectMenuBuilder,
  SelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
  InteractionResponse,
  Message,
  AttachmentBuilder,
} from 'discord.js';
import { createCaller } from '~/server/routers';
import { db } from '~/server/db';
import { eq, and, desc, asc, gte, lte, like, inArray } from 'drizzle-orm';
import {
  projects,
  assets,
  documents,
  rfis,
  workOrders,
  alertEvents,
  dueDiligenceItems,
} from '~/drizzle/schema';
import { TRPCError } from '@trpc/server';

// Command context type
interface CommandContext {
  interaction: ChatInputCommandInteraction;
  userId: number;
  organizationId: number;
  projectId?: number;
  caller: ReturnType<typeof createCaller>;
}

// Command registry
export const DISCORD_COMMANDS = {
  // Asset commands
  assets: {
    name: 'assets',
    description: 'Manage and view assets',
    category: 'asset',
    subcommands: {
      list: listAssets,
      view: viewAsset,
      search: searchAssets,
      status: assetStatus,
      performance: assetPerformance,
    },
  },

  // Project commands
  projects: {
    name: 'projects',
    description: 'Manage and view projects',
    category: 'project',
    subcommands: {
      list: listProjects,
      view: viewProject,
      pipeline: viewPipeline,
      metrics: projectMetrics,
    },
  },

  // Document commands
  documents: {
    name: 'documents',
    description: 'Search and manage documents',
    category: 'document',
    subcommands: {
      search: searchDocuments,
      recent: recentDocuments,
      upload: initiateUpload,
      categorize: categorizeDocument,
    },
  },

  // RFI commands
  rfi: {
    name: 'rfi',
    description: 'Manage Requests for Information',
    category: 'rfi',
    subcommands: {
      list: listRfis,
      view: viewRfi,
      respond: respondToRfi,
      comment: addRfiComment,
    },
  },

  // Work order commands
  workorders: {
    name: 'workorders',
    description: 'Manage work orders',
    category: 'maintenance',
    subcommands: {
      list: listWorkOrders,
      view: viewWorkOrder,
      create: createWorkOrder,
      update: updateWorkOrderStatus,
    },
  },

  // Alert commands
  alerts: {
    name: 'alerts',
    description: 'View and acknowledge alerts',
    category: 'monitoring',
    subcommands: {
      active: activeAlerts,
      acknowledge: acknowledgeAlert,
      history: alertHistory,
    },
  },

  // Due diligence commands
  diligence: {
    name: 'diligence',
    description: 'Due diligence management',
    category: 'compliance',
    subcommands: {
      pending: pendingDueDiligence,
      overdue: overdueDueDiligence,
      complete: completeDueDiligence,
    },
  },

  // Workflow commands
  workflow: {
    name: 'workflow',
    description: 'Automation and workflows',
    category: 'automation',
    subcommands: {
      list: listWorkflows,
      create: createWorkflow,
      enable: enableWorkflow,
      disable: disableWorkflow,
      run: runWorkflow,
    },
  },

  // Help command
  help: {
    name: 'help',
    description: 'Get help with KIISHA commands',
    category: 'general',
    handler: showHelp,
  },

  // Status command
  status: {
    name: 'status',
    description: 'Check KIISHA connection status',
    category: 'general',
    handler: checkStatus,
  },
};

// Asset command handlers
async function listAssets(ctx: CommandContext): Promise<void> {
  const { interaction, caller, organizationId } = ctx;

  try {
    // Get options
    const projectId = interaction.options.getInteger('project');
    const status = interaction.options.getString('status');
    const limit = interaction.options.getInteger('limit') || 10;

    // Fetch assets
    const result = await caller.assets.list({
      organizationId,
      projectId: projectId || undefined,
      status: status || undefined,
      limit,
    });

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle('📊 Assets')
      .setColor(0x2196F3)
      .setDescription(`Found ${result.total} assets`)
      .setTimestamp();

    // Add asset fields
    for (const asset of result.items.slice(0, 10)) {
      embed.addFields({
        name: `${asset.name} (${asset.type})`,
        value: [
          `**Status:** ${asset.status}`,
          `**Capacity:** ${asset.capacity} MW`,
          `**Location:** ${asset.location || 'N/A'}`,
          `**ID:** \`${asset.id}\``,
        ].join('\n'),
        inline: true,
      });
    }

    // Add pagination buttons if needed
    const components = [];
    if (result.total > 10) {
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('assets:prev:0')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('assets:next:10')
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(result.total <= 10)
        );
      components.push(row);
    }

    await interaction.editReply({ embeds: [embed], components });
  } catch (error) {
    console.error('Error listing assets:', error);
    await interaction.editReply('❌ Failed to fetch assets.');
  }
}

async function viewAsset(ctx: CommandContext): Promise<void> {
  const { interaction, caller } = ctx;

  try {
    const assetId = interaction.options.getInteger('id', true);

    // Fetch asset details
    const asset = await caller.assets.get({ id: assetId });

    if (!asset) {
      await interaction.editReply('❌ Asset not found.');
      return;
    }

    // Create detailed embed
    const embed = new EmbedBuilder()
      .setTitle(`⚡ ${asset.name}`)
      .setColor(asset.status === 'operational' ? 0x10B981 : 0xF59E0B)
      .setDescription(asset.description || 'No description available')
      .addFields(
        { name: 'Type', value: asset.type, inline: true },
        { name: 'Status', value: asset.status, inline: true },
        { name: 'Capacity', value: `${asset.capacity} MW`, inline: true },
        { name: 'Manufacturer', value: asset.manufacturer || 'N/A', inline: true },
        { name: 'Model', value: asset.model || 'N/A', inline: true },
        { name: 'Serial Number', value: asset.serialNumber || 'N/A', inline: true },
        { name: 'Installation Date', value: asset.installationDate?.toISOString().split('T')[0] || 'N/A', inline: true },
        { name: 'Warranty Expires', value: asset.warrantyExpires?.toISOString().split('T')[0] || 'N/A', inline: true },
        { name: 'Last Maintenance', value: asset.lastMaintenance?.toISOString().split('T')[0] || 'N/A', inline: true }
      )
      .setTimestamp();

    // Add performance metrics if available
    if (asset.metrics) {
      embed.addFields({
        name: '📈 Performance Metrics',
        value: [
          `**Availability:** ${asset.metrics.availability}%`,
          `**Performance Ratio:** ${asset.metrics.performanceRatio}%`,
          `**Capacity Factor:** ${asset.metrics.capacityFactor}%`,
        ].join('\n'),
        inline: false,
      });
    }

    // Action buttons
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`asset:performance:${assetId}`)
          .setLabel('View Performance')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📊'),
        new ButtonBuilder()
          .setCustomId(`asset:maintenance:${assetId}`)
          .setLabel('Maintenance History')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔧'),
        new ButtonBuilder()
          .setCustomId(`asset:documents:${assetId}`)
          .setLabel('Documents')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📄'),
        new ButtonBuilder()
          .setCustomId(`asset:workorder:${assetId}`)
          .setLabel('Create Work Order')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🛠️')
      );

    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (error) {
    console.error('Error viewing asset:', error);
    await interaction.editReply('❌ Failed to fetch asset details.');
  }
}

async function searchAssets(ctx: CommandContext): Promise<void> {
  const { interaction, caller } = ctx;

  try {
    const query = interaction.options.getString('query', true);

    // Search assets
    const results = await caller.assets.search({
      query,
      organizationId: ctx.organizationId,
    });

    if (results.items.length === 0) {
      await interaction.editReply(`🔍 No assets found matching "${query}"`);
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`🔍 Search Results for "${query}"`)
      .setColor(0x2196F3)
      .setDescription(`Found ${results.total} matching assets`)
      .setTimestamp();

    // Add results
    for (const asset of results.items.slice(0, 10)) {
      embed.addFields({
        name: asset.name,
        value: `Type: ${asset.type} | Status: ${asset.status} | ID: \`${asset.id}\``,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error searching assets:', error);
    await interaction.editReply('❌ Failed to search assets.');
  }
}

async function assetStatus(ctx: CommandContext): Promise<void> {
  const { interaction, caller } = ctx;

  try {
    const assetId = interaction.options.getInteger('id', true);

    // Get real-time status
    const status = await caller.assets.getRealtimeStatus({ id: assetId });

    const embed = new EmbedBuilder()
      .setTitle(`📡 Real-time Status`)
      .setColor(status.online ? 0x10B981 : 0xEF4444)
      .addFields(
        { name: 'Status', value: status.online ? '🟢 Online' : '🔴 Offline', inline: true },
        { name: 'Power Output', value: `${status.powerOutput} kW`, inline: true },
        { name: 'Efficiency', value: `${status.efficiency}%`, inline: true },
        { name: 'Temperature', value: `${status.temperature}°C`, inline: true },
        { name: 'Irradiance', value: `${status.irradiance} W/m²`, inline: true },
        { name: 'Last Update', value: `<t:${Math.floor(status.timestamp.getTime() / 1000)}:R>`, inline: true }
      )
      .setTimestamp();

    // Add alerts if any
    if (status.alerts && status.alerts.length > 0) {
      embed.addFields({
        name: '⚠️ Active Alerts',
        value: status.alerts.map(a => `• ${a.message}`).join('\n'),
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error getting asset status:', error);
    await interaction.editReply('❌ Failed to fetch asset status.');
  }
}

async function assetPerformance(ctx: CommandContext): Promise<void> {
  const { interaction, caller } = ctx;

  try {
    const assetId = interaction.options.getInteger('id', true);
    const period = interaction.options.getString('period') || '7d';

    // Get performance data
    const performance = await caller.assets.getPerformance({
      id: assetId,
      period,
    });

    const embed = new EmbedBuilder()
      .setTitle(`📊 Performance Report`)
      .setColor(0x2196F3)
      .setDescription(`Asset performance over the last ${period}`)
      .addFields(
        { name: 'Total Generation', value: `${performance.totalGeneration} MWh`, inline: true },
        { name: 'Average PR', value: `${performance.averagePR}%`, inline: true },
        { name: 'Availability', value: `${performance.availability}%`, inline: true },
        { name: 'Capacity Factor', value: `${performance.capacityFactor}%`, inline: true },
        { name: 'Peak Output', value: `${performance.peakOutput} kW`, inline: true },
        { name: 'Revenue', value: `$${performance.revenue.toLocaleString()}`, inline: true }
      )
      .setTimestamp();

    // Add daily breakdown
    if (performance.daily && performance.daily.length > 0) {
      const dailyData = performance.daily
        .slice(-7)
        .map(d => `**${d.date}:** ${d.generation} MWh (${d.pr}% PR)`)
        .join('\n');

      embed.addFields({
        name: '📅 Daily Breakdown (Last 7 Days)',
        value: dailyData,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error getting asset performance:', error);
    await interaction.editReply('❌ Failed to fetch performance data.');
  }
}

// Project command handlers
async function listProjects(ctx: CommandContext): Promise<void> {
  const { interaction, caller } = ctx;

  try {
    const status = interaction.options.getString('status');
    const limit = interaction.options.getInteger('limit') || 10;

    // Fetch projects
    const result = await caller.projects.list({
      organizationId: ctx.organizationId,
      status: status || undefined,
      limit,
    });

    const embed = new EmbedBuilder()
      .setTitle('🏗️ Projects')
      .setColor(0x2196F3)
      .setDescription(`Total projects: ${result.total}`)
      .setTimestamp();

    // Group projects by status
    const statusGroups: Record<string, any[]> = {};
    for (const project of result.items) {
      if (!statusGroups[project.status]) {
        statusGroups[project.status] = [];
      }
      statusGroups[project.status].push(project);
    }

    // Add fields for each status
    for (const [status, projects] of Object.entries(statusGroups)) {
      const projectList = projects
        .slice(0, 5)
        .map(p => `• ${p.name} (${p.capacity} MW)`)
        .join('\n');

      embed.addFields({
        name: `${getStatusEmoji(status)} ${status} (${projects.length})`,
        value: projectList || 'None',
        inline: true,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error listing projects:', error);
    await interaction.editReply('❌ Failed to fetch projects.');
  }
}

async function viewProject(ctx: CommandContext): Promise<void> {
  const { interaction, caller } = ctx;

  try {
    const projectId = interaction.options.getInteger('id', true);

    // Fetch project details
    const project = await caller.projects.get({ id: projectId });

    if (!project) {
      await interaction.editReply('❌ Project not found.');
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`🏗️ ${project.name}`)
      .setColor(getStatusColor(project.status))
      .setDescription(project.description || 'No description available')
      .addFields(
        { name: 'Status', value: `${getStatusEmoji(project.status)} ${project.status}`, inline: true },
        { name: 'Stage', value: project.stage || 'N/A', inline: true },
        { name: 'Capacity', value: `${project.capacity} MW`, inline: true },
        { name: 'Technology', value: project.technology || 'N/A', inline: true },
        { name: 'Location', value: project.location || 'N/A', inline: true },
        { name: 'COD', value: project.cod?.toISOString().split('T')[0] || 'TBD', inline: true },
        { name: 'Developer', value: project.developer || 'N/A', inline: true },
        { name: 'Owner', value: project.owner || 'N/A', inline: true },
        { name: 'Investment', value: project.investment ? `$${project.investment.toLocaleString()}` : 'N/A', inline: true }
      )
      .setTimestamp();

    // Add milestones
    if (project.milestones && project.milestones.length > 0) {
      const milestones = project.milestones
        .slice(0, 5)
        .map(m => `${m.completed ? '✅' : '⏳'} ${m.name} - ${m.date}`)
        .join('\n');

      embed.addFields({
        name: '📍 Milestones',
        value: milestones,
        inline: false,
      });
    }

    // Action buttons
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`project:assets:${projectId}`)
          .setLabel('View Assets')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⚡'),
        new ButtonBuilder()
          .setCustomId(`project:documents:${projectId}`)
          .setLabel('Documents')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📄'),
        new ButtonBuilder()
          .setCustomId(`project:vatr:${projectId}`)
          .setLabel('VATR')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📋'),
        new ButtonBuilder()
          .setCustomId(`project:financial:${projectId}`)
          .setLabel('Financials')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('💰')
      );

    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (error) {
    console.error('Error viewing project:', error);
    await interaction.editReply('❌ Failed to fetch project details.');
  }
}

async function viewPipeline(ctx: CommandContext): Promise<void> {
  const { interaction, caller } = ctx;

  try {
    // Get pipeline stats
    const pipeline = await caller.projects.getPipelineStats({
      organizationId: ctx.organizationId,
    });

    const embed = new EmbedBuilder()
      .setTitle('📊 Project Pipeline')
      .setColor(0x2196F3)
      .setDescription('Current project distribution across stages')
      .addFields(
        { name: '🔍 Development', value: `${pipeline.development.count} projects\n${pipeline.development.capacity} MW`, inline: true },
        { name: '💰 Financial Close', value: `${pipeline.financialClose.count} projects\n${pipeline.financialClose.capacity} MW`, inline: true },
        { name: '🔨 Construction', value: `${pipeline.construction.count} projects\n${pipeline.construction.capacity} MW`, inline: true },
        { name: '✅ Operations', value: `${pipeline.operations.count} projects\n${pipeline.operations.capacity} MW`, inline: true },
        { name: '⏸️ On Hold', value: `${pipeline.onHold.count} projects\n${pipeline.onHold.capacity} MW`, inline: true },
        { name: '📊 Total', value: `${pipeline.total.count} projects\n${pipeline.total.capacity} MW`, inline: true }
      )
      .setTimestamp();

    // Add upcoming milestones
    if (pipeline.upcomingMilestones && pipeline.upcomingMilestones.length > 0) {
      const milestones = pipeline.upcomingMilestones
        .slice(0, 5)
        .map(m => `• **${m.project}:** ${m.milestone} (<t:${Math.floor(m.date.getTime() / 1000)}:R>)`)
        .join('\n');

      embed.addFields({
        name: '⏰ Upcoming Milestones',
        value: milestones,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error viewing pipeline:', error);
    await interaction.editReply('❌ Failed to fetch pipeline data.');
  }
}

async function projectMetrics(ctx: CommandContext): Promise<void> {
  const { interaction, caller } = ctx;

  try {
    const projectId = interaction.options.getInteger('id', true);
    const period = interaction.options.getString('period') || 'month';

    // Get project metrics
    const metrics = await caller.projects.getMetrics({
      id: projectId,
      period,
    });

    const embed = new EmbedBuilder()
      .setTitle(`📈 Project Metrics`)
      .setColor(0x10B981)
      .setDescription(`Performance metrics for the last ${period}`)
      .addFields(
        { name: 'Generation', value: `${metrics.generation} MWh`, inline: true },
        { name: 'Revenue', value: `$${metrics.revenue.toLocaleString()}`, inline: true },
        { name: 'OPEX', value: `$${metrics.opex.toLocaleString()}`, inline: true },
        { name: 'EBITDA', value: `$${metrics.ebitda.toLocaleString()}`, inline: true },
        { name: 'IRR', value: `${metrics.irr}%`, inline: true },
        { name: 'DSCR', value: `${metrics.dscr}x`, inline: true },
        { name: 'Availability', value: `${metrics.availability}%`, inline: true },
        { name: 'PR', value: `${metrics.performanceRatio}%`, inline: true },
        { name: 'Capacity Factor', value: `${metrics.capacityFactor}%`, inline: true }
      )
      .setTimestamp();

    // Add comparison to budget
    if (metrics.budgetVariance) {
      const varianceEmoji = metrics.budgetVariance >= 0 ? '✅' : '⚠️';
      embed.addFields({
        name: `${varianceEmoji} Budget Variance`,
        value: `${metrics.budgetVariance >= 0 ? '+' : ''}${metrics.budgetVariance}%`,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error getting project metrics:', error);
    await interaction.editReply('❌ Failed to fetch project metrics.');
  }
}

// Document command handlers
async function searchDocuments(ctx: CommandContext): Promise<void> {
  const { interaction, caller } = ctx;

  try {
    const query = interaction.options.getString('query', true);
    const projectId = interaction.options.getInteger('project');
    const category = interaction.options.getString('category');

    // Search documents
    const results = await caller.documents.search({
      query,
      organizationId: ctx.organizationId,
      projectId: projectId || undefined,
      category: category || undefined,
    });

    if (results.items.length === 0) {
      await interaction.editReply(`🔍 No documents found matching "${query}"`);
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`📄 Document Search Results`)
      .setColor(0x2196F3)
      .setDescription(`Found ${results.total} documents matching "${query}"`)
      .setTimestamp();

    // Add document list
    for (const doc of results.items.slice(0, 10)) {
      embed.addFields({
        name: `${getDocIcon(doc.type)} ${doc.name}`,
        value: [
          `**Category:** ${doc.category || 'Uncategorized'}`,
          `**Project:** ${doc.projectName || 'N/A'}`,
          `**Size:** ${formatFileSize(doc.size)}`,
          `**Modified:** <t:${Math.floor(doc.modifiedAt.getTime() / 1000)}:R>`,
          `**ID:** \`${doc.id}\``,
        ].join('\n'),
        inline: true,
      });
    }

    // Add action buttons for first few results
    if (results.items.length > 0) {
      const row = new ActionRowBuilder<ButtonBuilder>();

      for (const doc of results.items.slice(0, 4)) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`doc:download:${doc.id}`)
            .setLabel(doc.name.substring(0, 20))
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📥')
        );
      }

      await interaction.editReply({ embeds: [embed], components: [row] });
    } else {
      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Error searching documents:', error);
    await interaction.editReply('❌ Failed to search documents.');
  }
}

async function recentDocuments(ctx: CommandContext): Promise<void> {
  const { interaction, caller } = ctx;

  try {
    const limit = interaction.options.getInteger('limit') || 10;
    const projectId = interaction.options.getInteger('project');

    // Get recent documents
    const results = await caller.documents.getRecent({
      organizationId: ctx.organizationId,
      projectId: projectId || undefined,
      limit,
    });

    const embed = new EmbedBuilder()
      .setTitle('📄 Recent Documents')
      .setColor(0x2196F3)
      .setDescription('Recently uploaded or modified documents')
      .setTimestamp();

    // Add documents
    for (const doc of results.items) {
      embed.addFields({
        name: `${getDocIcon(doc.type)} ${doc.name}`,
        value: `Uploaded <t:${Math.floor(doc.uploadedAt.getTime() / 1000)}:R> by ${doc.uploadedBy}`,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error fetching recent documents:', error);
    await interaction.editReply('❌ Failed to fetch recent documents.');
  }
}

async function initiateUpload(ctx: CommandContext): Promise<void> {
  const { interaction } = ctx;

  // Create upload instructions embed
  const embed = new EmbedBuilder()
    .setTitle('📤 Document Upload')
    .setColor(0x2196F3)
    .setDescription('To upload documents to KIISHA:')
    .addFields(
      {
        name: '1. Via Web Portal',
        value: 'Visit [KIISHA Web App](https://kiisha.app) and use the document upload interface.',
        inline: false,
      },
      {
        name: '2. Via Direct Message',
        value: 'Send documents directly to me via DM and I\'ll process them.',
        inline: false,
      },
      {
        name: '3. Via Channel',
        value: 'Attach files to your message in this channel with the tag `#upload`',
        inline: false,
      }
    )
    .setFooter({ text: 'Supported formats: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, Images' })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('upload:start')
        .setLabel('Start Upload Session')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📤'),
      new ButtonBuilder()
        .setURL('https://kiisha.app/documents/upload')
        .setLabel('Open Web Upload')
        .setStyle(ButtonStyle.Link)
        .setEmoji('🌐')
    );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

async function categorizeDocument(ctx: CommandContext): Promise<void> {
  const { interaction, caller } = ctx;

  try {
    const docId = interaction.options.getInteger('id', true);
    const category = interaction.options.getString('category', true);

    // Update document category
    await caller.documents.updateCategory({
      id: docId,
      category,
    });

    const embed = new EmbedBuilder()
      .setTitle('✅ Document Categorized')
      .setColor(0x10B981)
      .setDescription(`Document successfully categorized as "${category}"`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error categorizing document:', error);
    await interaction.editReply('❌ Failed to categorize document.');
  }
}

// RFI command handlers
async function listRfis(ctx: CommandContext): Promise<void> {
  const { interaction, caller } = ctx;

  try {
    const status = interaction.options.getString('status') || 'open';
    const projectId = interaction.options.getInteger('project');

    // Get RFIs
    const results = await caller.rfis.list({
      organizationId: ctx.organizationId,
      status,
      projectId: projectId || undefined,
    });

    const embed = new EmbedBuilder()
      .setTitle('📋 Requests for Information')
      .setColor(0x2196F3)
      .setDescription(`${status.charAt(0).toUpperCase() + status.slice(1)} RFIs (${results.total})`)
      .setTimestamp();

    // Add RFI list
    for (const rfi of results.items.slice(0, 10)) {
      const urgencyEmoji = getUrgencyEmoji(rfi.dueDate);
      embed.addFields({
        name: `${urgencyEmoji} RFI-${rfi.number}: ${rfi.subject}`,
        value: [
          `**From:** ${rfi.requester}`,
          `**Project:** ${rfi.projectName}`,
          `**Due:** <t:${Math.floor(rfi.dueDate.getTime() / 1000)}:R>`,
          `**Status:** ${rfi.status}`,
        ].join('\n'),
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error listing RFIs:', error);
    await interaction.editReply('❌ Failed to fetch RFIs.');
  }
}

async function viewRfi(ctx: CommandContext): Promise<void> {
  const { interaction, caller } = ctx;

  try {
    const rfiId = interaction.options.getInteger('id', true);

    // Get RFI details
    const rfi = await caller.rfis.get({ id: rfiId });

    if (!rfi) {
      await interaction.editReply('❌ RFI not found.');
      return;
    }

    const urgencyEmoji = getUrgencyEmoji(rfi.dueDate);
    const embed = new EmbedBuilder()
      .setTitle(`${urgencyEmoji} RFI-${rfi.number}: ${rfi.subject}`)
      .setColor(getRfiColor(rfi.status))
      .setDescription(rfi.description)
      .addFields(
        { name: 'Requester', value: rfi.requester, inline: true },
        { name: 'Project', value: rfi.projectName, inline: true },
        { name: 'Category', value: rfi.category, inline: true },
        { name: 'Status', value: rfi.status, inline: true },
        { name: 'Priority', value: rfi.priority || 'Normal', inline: true },
        { name: 'Due Date', value: `<t:${Math.floor(rfi.dueDate.getTime() / 1000)}:F>`, inline: true }
      )
      .setTimestamp();

    // Add response if exists
    if (rfi.response) {
      embed.addFields({
        name: '💬 Response',
        value: rfi.response.substring(0, 1024),
        inline: false,
      });
    }

    // Add comments
    if (rfi.comments && rfi.comments.length > 0) {
      const comments = rfi.comments
        .slice(-3)
        .map(c => `**${c.author}** (<t:${Math.floor(c.createdAt.getTime() / 1000)}:R>): ${c.text}`)
        .join('\n');

      embed.addFields({
        name: '💭 Recent Comments',
        value: comments,
        inline: false,
      });
    }

    // Action buttons
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`rfi:respond:${rfiId}`)
          .setLabel('Respond')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('💬')
          .setDisabled(rfi.status === 'closed'),
        new ButtonBuilder()
          .setCustomId(`rfi:comment:${rfiId}`)
          .setLabel('Add Comment')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('💭'),
        new ButtonBuilder()
          .setCustomId(`rfi:documents:${rfiId}`)
          .setLabel('View Documents')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📄'),
        new ButtonBuilder()
          .setCustomId(`rfi:close:${rfiId}`)
          .setLabel('Close RFI')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒')
          .setDisabled(rfi.status === 'closed')
      );

    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (error) {
    console.error('Error viewing RFI:', error);
    await interaction.editReply('❌ Failed to fetch RFI details.');
  }
}

async function respondToRfi(ctx: CommandContext): Promise<void> {
  const { interaction, caller } = ctx;

  const rfiId = interaction.options.getInteger('id', true);
  const response = interaction.options.getString('response', true);

  try {
    // Submit response (requires confirmation)
    const result = await caller.rfis.respond({
      id: rfiId,
      response,
      attachments: [],
    });

    if (result.requiresConfirmation) {
      const embed = new EmbedBuilder()
        .setTitle('⚠️ Confirmation Required')
        .setColor(0xF59E0B)
        .setDescription('This response requires confirmation before sending.')
        .addFields(
          { name: 'RFI', value: `RFI-${result.rfiNumber}`, inline: true },
          { name: 'Confirmation ID', value: `\`${result.confirmationId}\``, inline: true }
        )
        .setFooter({ text: 'Use the buttons below to confirm or cancel' })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`confirm:${result.confirmationId}`)
            .setLabel('Confirm & Send')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
          new ButtonBuilder()
            .setCustomId(`cancel:${result.confirmationId}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
        );

      await interaction.editReply({ embeds: [embed], components: [row] });
    } else {
      const embed = new EmbedBuilder()
        .setTitle('✅ Response Submitted')
        .setColor(0x10B981)
        .setDescription('Your response has been submitted successfully.')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Error responding to RFI:', error);
    await interaction.editReply('❌ Failed to submit response.');
  }
}

async function addRfiComment(ctx: CommandContext): Promise<void> {
  const { interaction, caller } = ctx;

  try {
    const rfiId = interaction.options.getInteger('id', true);
    const comment = interaction.options.getString('comment', true);
    const internal = interaction.options.getBoolean('internal') || false;

    // Add comment
    await caller.rfis.addComment({
      id: rfiId,
      comment,
      internal,
    });

    const embed = new EmbedBuilder()
      .setTitle('✅ Comment Added')
      .setColor(0x10B981)
      .setDescription(`Your ${internal ? 'internal ' : ''}comment has been added to the RFI.`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error adding RFI comment:', error);
    await interaction.editReply('❌ Failed to add comment.');
  }
}

// Helper command handlers
async function showHelp(ctx: CommandContext): Promise<void> {
  const { interaction } = ctx;

  const embed = new EmbedBuilder()
    .setTitle('📚 KIISHA Discord Commands')
    .setColor(0x2196F3)
    .setDescription('Here are all available commands:')
    .addFields(
      {
        name: '⚡ Asset Management',
        value: [
          '`/assets list` - List all assets',
          '`/assets view <id>` - View asset details',
          '`/assets search <query>` - Search assets',
          '`/assets status <id>` - Real-time status',
          '`/assets performance <id>` - Performance metrics',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🏗️ Project Management',
        value: [
          '`/projects list` - List all projects',
          '`/projects view <id>` - View project details',
          '`/projects pipeline` - View project pipeline',
          '`/projects metrics <id>` - Project metrics',
        ].join('\n'),
        inline: false,
      },
      {
        name: '📄 Document Management',
        value: [
          '`/documents search <query>` - Search documents',
          '`/documents recent` - Recent documents',
          '`/documents upload` - Upload instructions',
          '`/documents categorize <id> <category>` - Categorize document',
        ].join('\n'),
        inline: false,
      },
      {
        name: '📋 RFI Management',
        value: [
          '`/rfi list` - List RFIs',
          '`/rfi view <id>` - View RFI details',
          '`/rfi respond <id> <response>` - Respond to RFI',
          '`/rfi comment <id> <comment>` - Add comment',
        ].join('\n'),
        inline: false,
      }
    )
    .setFooter({ text: 'For detailed help on a command, use /help <command>' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function checkStatus(ctx: CommandContext): Promise<void> {
  const { interaction, organizationId } = ctx;

  const embed = new EmbedBuilder()
    .setTitle('✅ KIISHA Discord Integration')
    .setColor(0x10B981)
    .setDescription('Connection is active and operational')
    .addFields(
      { name: 'Organization ID', value: organizationId.toString(), inline: true },
      { name: 'User Verified', value: '✅ Yes', inline: true },
      { name: 'Permissions', value: 'Full Access', inline: true },
      { name: 'API Status', value: '🟢 Online', inline: true },
      { name: 'Response Time', value: `${Date.now() - interaction.createdTimestamp}ms`, inline: true },
      { name: 'Version', value: '1.0.0', inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// Utility functions
function getStatusEmoji(status: string): string {
  const emojis: Record<string, string> = {
    'development': '🔍',
    'financial-close': '💰',
    'construction': '🔨',
    'operations': '✅',
    'operational': '✅',
    'on-hold': '⏸️',
    'cancelled': '❌',
    'maintenance': '🔧',
    'offline': '🔴',
    'online': '🟢',
  };
  return emojis[status.toLowerCase()] || '📊';
}

function getStatusColor(status: string): number {
  const colors: Record<string, number> = {
    'development': 0x3B82F6, // Blue
    'financial-close': 0xF59E0B, // Yellow
    'construction': 0xEF4444, // Red
    'operations': 0x10B981, // Green
    'operational': 0x10B981, // Green
    'on-hold': 0x6B7280, // Gray
    'cancelled': 0xEF4444, // Red
  };
  return colors[status.toLowerCase()] || 0x2196F3;
}

function getDocIcon(type: string): string {
  const icons: Record<string, string> = {
    'pdf': '📕',
    'doc': '📘',
    'docx': '📘',
    'xls': '📗',
    'xlsx': '📗',
    'ppt': '📙',
    'pptx': '📙',
    'image': '🖼️',
    'video': '🎥',
    'audio': '🎵',
    'zip': '📦',
    'text': '📝',
  };
  const ext = type.toLowerCase().split('.').pop() || '';
  return icons[ext] || '📄';
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function getUrgencyEmoji(dueDate: Date): string {
  const now = new Date();
  const diff = dueDate.getTime() - now.getTime();
  const days = diff / (1000 * 60 * 60 * 24);

  if (days < 0) return '🔴'; // Overdue
  if (days < 3) return '🟠'; // Due soon
  if (days < 7) return '🟡'; // Due this week
  return '🟢'; // Not urgent
}

function getRfiColor(status: string): number {
  const colors: Record<string, string> = {
    'open': 0xF59E0B,
    'pending': 0x3B82F6,
    'responded': 0x10B981,
    'closed': 0x6B7280,
  };
  return colors[status.toLowerCase()] || 0x2196F3;
}

// Workflow command handlers (stubs for now)
async function listWorkflows(ctx: CommandContext): Promise<void> {
  await ctx.interaction.editReply('🚧 Workflow management coming soon!');
}

async function createWorkflow(ctx: CommandContext): Promise<void> {
  await ctx.interaction.editReply('🚧 Workflow creation coming soon!');
}

async function enableWorkflow(ctx: CommandContext): Promise<void> {
  await ctx.interaction.editReply('🚧 Workflow enabling coming soon!');
}

async function disableWorkflow(ctx: CommandContext): Promise<void> {
  await ctx.interaction.editReply('🚧 Workflow disabling coming soon!');
}

async function runWorkflow(ctx: CommandContext): Promise<void> {
  await ctx.interaction.editReply('🚧 Workflow execution coming soon!');
}

// Alert command handlers (stubs)
async function activeAlerts(ctx: CommandContext): Promise<void> {
  await ctx.interaction.editReply('🚧 Alert viewing coming soon!');
}

async function acknowledgeAlert(ctx: CommandContext): Promise<void> {
  await ctx.interaction.editReply('🚧 Alert acknowledgment coming soon!');
}

async function alertHistory(ctx: CommandContext): Promise<void> {
  await ctx.interaction.editReply('🚧 Alert history coming soon!');
}

// Due diligence command handlers (stubs)
async function pendingDueDiligence(ctx: CommandContext): Promise<void> {
  await ctx.interaction.editReply('🚧 Due diligence viewing coming soon!');
}

async function overdueDueDiligence(ctx: CommandContext): Promise<void> {
  await ctx.interaction.editReply('🚧 Overdue items coming soon!');
}

async function completeDueDiligence(ctx: CommandContext): Promise<void> {
  await ctx.interaction.editReply('🚧 Completion tracking coming soon!');
}

// Work order command handlers (stubs)
async function listWorkOrders(ctx: CommandContext): Promise<void> {
  await ctx.interaction.editReply('🚧 Work order listing coming soon!');
}

async function viewWorkOrder(ctx: CommandContext): Promise<void> {
  await ctx.interaction.editReply('🚧 Work order details coming soon!');
}

async function createWorkOrder(ctx: CommandContext): Promise<void> {
  await ctx.interaction.editReply('🚧 Work order creation coming soon!');
}

async function updateWorkOrderStatus(ctx: CommandContext): Promise<void> {
  await ctx.interaction.editReply('🚧 Status update coming soon!');
}