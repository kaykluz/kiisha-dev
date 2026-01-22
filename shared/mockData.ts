// Mock data for KIISHA demo - Apache City Portfolio

export const mockPortfolio = {
  id: 1,
  name: "Apache City",
  description: "Northeast renewable energy portfolio with solar and battery storage assets",
  region: "Northeast US",
};

export const mockProjects = [
  {
    id: 1,
    portfolioId: 1,
    name: "MA - Gillette BTM",
    code: "MA-GIL-001",
    state: "Massachusetts",
    technology: "PV" as const,
    capacityMw: 12.5,
    capacityMwh: null,
    status: "development" as const,
    stage: "development" as const,
    latitude: 42.4668,
    longitude: -71.2872,
  },
  {
    id: 2,
    portfolioId: 1,
    name: "NY - Saratoga CDG 1",
    code: "NY-SAR-001",
    state: "New York",
    technology: "PV+BESS" as const,
    capacityMw: 8.2,
    capacityMwh: 16.4,
    status: "development" as const,
    stage: "ntp" as const,
    latitude: 43.0831,
    longitude: -73.7846,
  },
  {
    id: 3,
    portfolioId: 1,
    name: "CT - Hartford Solar",
    code: "CT-HAR-001",
    state: "Connecticut",
    technology: "PV" as const,
    capacityMw: 5.8,
    capacityMwh: null,
    status: "construction" as const,
    stage: "construction" as const,
    latitude: 41.7658,
    longitude: -72.6734,
  },
  {
    id: 4,
    portfolioId: 1,
    name: "NJ - Princeton BESS",
    code: "NJ-PRI-001",
    state: "New Jersey",
    technology: "BESS" as const,
    capacityMw: null,
    capacityMwh: 25.0,
    status: "development" as const,
    stage: "feasibility" as const,
    latitude: 40.3573,
    longitude: -74.6672,
  },
  {
    id: 5,
    portfolioId: 1,
    name: "PA - Lancaster CDG",
    code: "PA-LAN-001",
    state: "Pennsylvania",
    technology: "PV" as const,
    capacityMw: 15.0,
    capacityMwh: null,
    status: "operational" as const,
    stage: "cod" as const,
    latitude: 40.0379,
    longitude: -76.3055,
  },
  {
    id: 6,
    portfolioId: 1,
    name: "VT - Burlington Solar",
    code: "VT-BUR-001",
    state: "Vermont",
    technology: "PV+BESS" as const,
    capacityMw: 6.5,
    capacityMwh: 13.0,
    status: "development" as const,
    stage: "development" as const,
    latitude: 44.4759,
    longitude: -73.2121,
  },
  {
    id: 7,
    portfolioId: 1,
    name: "ME - Portland Wind",
    code: "ME-POR-001",
    state: "Maine",
    technology: "Wind" as const,
    capacityMw: 22.0,
    capacityMwh: null,
    status: "prospecting" as const,
    stage: "feasibility" as const,
    latitude: 43.6591,
    longitude: -70.2568,
  },
];

export const mockDocumentCategories = [
  { id: 1, name: "Site & Real Estate", code: "SITE", sortOrder: 1, icon: "map-pin", color: "#3b82f6" },
  { id: 2, name: "Permits & Approvals", code: "PERMITS", sortOrder: 2, icon: "file-check", color: "#10b981" },
  { id: 3, name: "Technical", code: "TECH", sortOrder: 3, icon: "wrench", color: "#6366f1" },
  { id: 4, name: "Interconnection", code: "INTERCON", sortOrder: 4, icon: "plug", color: "#f59e0b" },
  { id: 5, name: "Financial", code: "FIN", sortOrder: 5, icon: "dollar-sign", color: "#22c55e" },
  { id: 6, name: "Legal", code: "LEGAL", sortOrder: 6, icon: "scale", color: "#8b5cf6" },
  { id: 7, name: "Environmental", code: "ENV", sortOrder: 7, icon: "leaf", color: "#14b8a6" },
  { id: 8, name: "Financial Models", code: "FINMODEL", sortOrder: 8, icon: "calculator", color: "#ec4899", isSpecialized: true },
  { id: 9, name: "Energy Reports", code: "ENERGY", sortOrder: 9, icon: "zap", color: "#f97316", isSpecialized: true },
  { id: 10, name: "System Design", code: "SYSDESIGN", sortOrder: 10, icon: "layout", color: "#06b6d4", isSpecialized: true },
];

export const mockDocumentTypes = [
  // Site & Real Estate
  { id: 1, categoryId: 1, name: "Lease Agreement", code: "LEASE", required: true, sortOrder: 1 },
  { id: 2, categoryId: 1, name: "Land Survey", code: "SURVEY", required: true, sortOrder: 2 },
  { id: 3, categoryId: 1, name: "Title Report", code: "TITLE", required: true, sortOrder: 3 },
  { id: 4, categoryId: 1, name: "Site Plan", code: "SITEPLAN", required: false, sortOrder: 4 },
  { id: 5, categoryId: 1, name: "Easement Agreement", code: "EASEMENT", required: false, sortOrder: 5 },
  // Permits & Approvals
  { id: 6, categoryId: 2, name: "Building Permit", code: "BLDGPMT", required: true, sortOrder: 1 },
  { id: 7, categoryId: 2, name: "Electrical Permit", code: "ELECPMT", required: true, sortOrder: 2 },
  { id: 8, categoryId: 2, name: "Zoning Approval", code: "ZONING", required: true, sortOrder: 3 },
  { id: 9, categoryId: 2, name: "Special Use Permit", code: "SUP", required: false, sortOrder: 4 },
  // Technical
  { id: 10, categoryId: 3, name: "System Design", code: "DESIGN", required: true, sortOrder: 1 },
  { id: 11, categoryId: 3, name: "Equipment Specs", code: "EQSPEC", required: true, sortOrder: 2 },
  { id: 12, categoryId: 3, name: "Energy Model", code: "EMODEL", required: true, sortOrder: 3 },
  { id: 13, categoryId: 3, name: "Geotechnical Report", code: "GEOTECH", required: false, sortOrder: 4 },
  // Interconnection
  { id: 14, categoryId: 4, name: "Interconnection Agreement", code: "IA", required: true, sortOrder: 1 },
  { id: 15, categoryId: 4, name: "System Impact Study", code: "SIS", required: true, sortOrder: 2 },
  { id: 16, categoryId: 4, name: "Facilities Study", code: "FS", required: false, sortOrder: 3 },
  // Financial
  { id: 17, categoryId: 5, name: "Pro Forma", code: "PROFORMA", required: true, sortOrder: 1 },
  { id: 18, categoryId: 5, name: "PPA Agreement", code: "PPA", required: true, sortOrder: 2 },
  { id: 19, categoryId: 5, name: "Tax Equity LOI", code: "TELOI", required: false, sortOrder: 3 },
  // Legal
  { id: 20, categoryId: 6, name: "EPC Contract", code: "EPC", required: true, sortOrder: 1 },
  { id: 21, categoryId: 6, name: "O&M Agreement", code: "OMA", required: true, sortOrder: 2 },
  { id: 22, categoryId: 6, name: "Insurance Certificate", code: "INS", required: true, sortOrder: 3 },
  // Environmental
  { id: 23, categoryId: 7, name: "Phase I ESA", code: "ESA1", required: true, sortOrder: 1 },
  { id: 24, categoryId: 7, name: "Wetlands Delineation", code: "WETLAND", required: false, sortOrder: 2 },
  { id: 25, categoryId: 7, name: "NEPA Review", code: "NEPA", required: false, sortOrder: 3 },
  // Financial Models (specialized)
  { id: 26, categoryId: 8, name: "Project Finance Model", code: "PFM", required: true, sortOrder: 1, extractionType: "financial_model" },
  { id: 27, categoryId: 8, name: "Acquisition Model", code: "ACQ", required: false, sortOrder: 2, extractionType: "financial_model" },
  { id: 28, categoryId: 8, name: "Development Budget", code: "DEVBUDGET", required: true, sortOrder: 3, extractionType: "financial_model" },
  { id: 29, categoryId: 8, name: "Cash Flow Forecast", code: "CASHFLOW", required: false, sortOrder: 4, extractionType: "financial_model" },
  // Energy Reports (specialized)
  { id: 30, categoryId: 9, name: "PVsyst Report", code: "PVSYST", required: true, sortOrder: 1, extractionType: "energy_report", softwareSource: "pvsyst" },
  { id: 31, categoryId: 9, name: "Homer Pro Analysis", code: "HOMER", required: false, sortOrder: 2, extractionType: "energy_report", softwareSource: "homer_pro" },
  { id: 32, categoryId: 9, name: "SAM Model", code: "SAM", required: false, sortOrder: 3, extractionType: "energy_report", softwareSource: "sam" },
  { id: 33, categoryId: 9, name: "Wind Resource Assessment", code: "WINDRES", required: false, sortOrder: 4, extractionType: "energy_report" },
  { id: 34, categoryId: 9, name: "Solar Resource Assessment", code: "SOLARRES", required: false, sortOrder: 5, extractionType: "energy_report" },
  // System Design (specialized)
  { id: 35, categoryId: 10, name: "Single Line Diagram", code: "SLD", required: true, sortOrder: 1, extractionType: "technical_design", designType: "sld" },
  { id: 36, categoryId: 10, name: "Site Layout", code: "LAYOUT", required: true, sortOrder: 2, extractionType: "technical_design", designType: "layout" },
  { id: 37, categoryId: 10, name: "3D Model", code: "3DMODEL", required: false, sortOrder: 3, extractionType: "technical_design", designType: "3d_model" },
  { id: 38, categoryId: 10, name: "Structural Assessment", code: "STRUCT", required: false, sortOrder: 4, extractionType: "technical_design", designType: "structural" },
  { id: 39, categoryId: 10, name: "Electrical Design", code: "ELECDESIGN", required: true, sortOrder: 5, extractionType: "technical_design", designType: "electrical" },
];

// Document status matrix - project x document type
export type DocumentStatus = "verified" | "pending" | "missing" | "na";

export const mockDocumentMatrix: Record<number, Record<number, DocumentStatus>> = {
  // Project 1 - MA Gillette
  1: {
    1: "verified", 2: "verified", 3: "pending", 4: "verified", 5: "na",
    6: "pending", 7: "missing", 8: "verified", 9: "na",
    10: "verified", 11: "verified", 12: "pending", 13: "missing",
    14: "pending", 15: "missing", 16: "na",
    17: "verified", 18: "pending", 19: "missing",
    20: "missing", 21: "missing", 22: "pending",
    23: "verified", 24: "na", 25: "na",
    // Financial Models
    26: "verified", 27: "na", 28: "pending", 29: "missing",
    // Energy Reports
    30: "verified", 31: "na", 32: "na", 33: "na", 34: "pending",
    // System Design
    35: "verified", 36: "pending", 37: "na", 38: "missing", 39: "pending",
  },
  // Project 2 - NY Saratoga
  2: {
    1: "verified", 2: "verified", 3: "verified", 4: "verified", 5: "verified",
    6: "verified", 7: "verified", 8: "verified", 9: "na",
    10: "verified", 11: "verified", 12: "verified", 13: "verified",
    14: "verified", 15: "verified", 16: "pending",
    17: "verified", 18: "verified", 19: "pending",
    20: "pending", 21: "missing", 22: "verified",
    23: "verified", 24: "verified", 25: "na",
    // Financial Models
    26: "verified", 27: "pending", 28: "verified", 29: "na",
    // Energy Reports
    30: "verified", 31: "verified", 32: "na", 33: "na", 34: "verified",
    // System Design
    35: "verified", 36: "verified", 37: "pending", 38: "na", 39: "verified",
  },
  // Project 3 - CT Hartford
  3: {
    1: "verified", 2: "verified", 3: "verified", 4: "verified", 5: "na",
    6: "verified", 7: "verified", 8: "verified", 9: "na",
    10: "verified", 11: "verified", 12: "verified", 13: "na",
    14: "verified", 15: "verified", 16: "verified",
    17: "verified", 18: "verified", 19: "verified",
    20: "verified", 21: "pending", 22: "verified",
    23: "verified", 24: "na", 25: "na",
    // Financial Models
    26: "verified", 27: "na", 28: "verified", 29: "verified",
    // Energy Reports
    30: "verified", 31: "na", 32: "na", 33: "na", 34: "verified",
    // System Design
    35: "verified", 36: "verified", 37: "na", 38: "verified", 39: "verified",
  },
  // Project 4 - NJ Princeton
  4: {
    1: "pending", 2: "missing", 3: "missing", 4: "missing", 5: "na",
    6: "missing", 7: "missing", 8: "pending", 9: "na",
    10: "pending", 11: "missing", 12: "missing", 13: "missing",
    14: "missing", 15: "missing", 16: "na",
    17: "pending", 18: "missing", 19: "na",
    20: "missing", 21: "missing", 22: "missing",
    23: "missing", 24: "na", 25: "na",
    // Financial Models
    26: "pending", 27: "na", 28: "missing", 29: "na",
    // Energy Reports
    30: "missing", 31: "na", 32: "na", 33: "na", 34: "missing",
    // System Design
    35: "missing", 36: "missing", 37: "na", 38: "na", 39: "missing",
  },
  // Project 5 - PA Lancaster
  5: {
    1: "verified", 2: "verified", 3: "verified", 4: "verified", 5: "verified",
    6: "verified", 7: "verified", 8: "verified", 9: "na",
    10: "verified", 11: "verified", 12: "verified", 13: "verified",
    14: "verified", 15: "verified", 16: "verified",
    17: "verified", 18: "verified", 19: "verified",
    20: "verified", 21: "verified", 22: "verified",
    23: "verified", 24: "verified", 25: "na",
    // Financial Models
    26: "verified", 27: "verified", 28: "verified", 29: "verified",
    // Energy Reports
    30: "verified", 31: "na", 32: "na", 33: "na", 34: "verified",
    // System Design
    35: "verified", 36: "verified", 37: "verified", 38: "verified", 39: "verified",
  },
  // Project 6 - VT Burlington
  6: {
    1: "verified", 2: "pending", 3: "pending", 4: "missing", 5: "na",
    6: "missing", 7: "missing", 8: "pending", 9: "na",
    10: "pending", 11: "pending", 12: "missing", 13: "na",
    14: "pending", 15: "missing", 16: "na",
    17: "pending", 18: "missing", 19: "na",
    20: "missing", 21: "missing", 22: "missing",
    23: "pending", 24: "na", 25: "na",
    // Financial Models
    26: "pending", 27: "na", 28: "missing", 29: "na",
    // Energy Reports
    30: "pending", 31: "na", 32: "na", 33: "na", 34: "missing",
    // System Design
    35: "missing", 36: "pending", 37: "na", 38: "na", 39: "missing",
  },
  // Project 7 - ME Portland
  7: {
    1: "missing", 2: "missing", 3: "missing", 4: "missing", 5: "na",
    6: "missing", 7: "missing", 8: "missing", 9: "na",
    10: "missing", 11: "missing", 12: "missing", 13: "na",
    14: "missing", 15: "missing", 16: "na",
    17: "pending", 18: "missing", 19: "na",
    20: "missing", 21: "missing", 22: "missing",
    23: "missing", 24: "na", 25: "na",
    // Financial Models
    26: "missing", 27: "na", 28: "missing", 29: "na",
    // Energy Reports
    30: "missing", 31: "na", 32: "na", 33: "na", 34: "missing",
    // System Design
    35: "missing", 36: "missing", 37: "na", 38: "na", 39: "missing",
  },
};

export const mockRfis = [
  {
    id: 1,
    projectId: 1,
    code: "RFI-001",
    title: "Confirm lease payment schedule with landowner",
    description: "Need to verify the annual lease payment schedule and escalation terms with the landowner before finalizing the lease agreement.",
    notes: "Landowner prefers quarterly payments. Need to update pro forma accordingly.",
    category: "Site & Real Estate",
    tags: ["Acquisition-CP", "Lease"],
    priority: "high" as const,
    status: "open" as const,
    dueDate: "2026-01-20",
  },
  {
    id: 2,
    projectId: 1,
    code: "RFI-002",
    title: "Obtain electrical permit application status",
    description: "Check with municipality on the status of the electrical permit application submitted on Dec 15.",
    notes: "Called town hall, they said 2-3 weeks for review.",
    category: "Permits",
    tags: ["Permits", "Electrical"],
    priority: "medium" as const,
    status: "in_progress" as const,
    dueDate: "2026-01-25",
  },
  {
    id: 3,
    projectId: 2,
    code: "RFI-003",
    title: "Request updated interconnection cost estimate",
    description: "The utility provided a preliminary cost estimate 6 months ago. Need to request an updated estimate before NTP.",
    notes: null,
    category: "Interconnection",
    tags: ["Interconnection", "Costs"],
    priority: "high" as const,
    status: "open" as const,
    dueDate: "2026-01-18",
  },
  {
    id: 4,
    projectId: 2,
    code: "RFI-004",
    title: "Verify BESS warranty terms",
    description: "Confirm the battery warranty terms with the manufacturer, specifically regarding capacity degradation guarantees.",
    notes: "Manufacturer confirmed 80% capacity at 10 years.",
    category: "Technical",
    tags: ["Technical", "BESS", "Warranty"],
    priority: "medium" as const,
    status: "resolved" as const,
    dueDate: "2026-01-10",
  },
  {
    id: 5,
    projectId: 3,
    code: "RFI-005",
    title: "Finalize O&M contractor selection",
    description: "Review final proposals from three O&M contractors and make selection recommendation.",
    notes: "SunOps and CleanEnergy are top two candidates. Awaiting reference checks.",
    category: "Legal",
    tags: ["O&M", "Contracts"],
    priority: "high" as const,
    status: "in_progress" as const,
    dueDate: "2026-01-22",
  },
  {
    id: 6,
    projectId: 4,
    code: "RFI-006",
    title: "Complete Phase I ESA for site",
    description: "Environmental site assessment needs to be completed before proceeding with development.",
    notes: null,
    category: "Environmental",
    tags: ["Environmental", "ESA"],
    priority: "critical" as const,
    status: "open" as const,
    dueDate: "2026-01-30",
  },
  {
    id: 7,
    projectId: 1,
    code: "RFI-007",
    title: "Update energy model with latest weather data",
    description: "Incorporate 2025 TMY data into the energy production model.",
    notes: null,
    category: "Technical",
    tags: ["Technical", "Energy Model"],
    priority: "low" as const,
    status: "open" as const,
    dueDate: "2026-02-15",
  },
  {
    id: 8,
    projectId: 6,
    code: "RFI-008",
    title: "Negotiate land survey scope with surveyor",
    description: "Define scope for ALTA survey including all easements and encumbrances.",
    notes: "Surveyor available to start next week.",
    category: "Site & Real Estate",
    tags: ["Site", "Survey"],
    priority: "medium" as const,
    status: "in_progress" as const,
    dueDate: "2026-01-28",
  },
  {
    id: 9,
    projectId: 5,
    code: "RFI-009",
    title: "Confirm COD milestone payment",
    description: "Verify that all COD conditions have been met for milestone payment release.",
    notes: "All conditions verified. Payment processing.",
    category: "Financial",
    tags: ["Financial", "COD"],
    priority: "high" as const,
    status: "resolved" as const,
    dueDate: "2026-01-05",
  },
  {
    id: 10,
    projectId: 2,
    code: "RFI-010",
    title: "Review PPA pricing adjustment clause",
    description: "Legal review of the PPA pricing adjustment mechanism for inflation indexing.",
    notes: null,
    category: "Legal",
    tags: ["Legal", "PPA"],
    priority: "medium" as const,
    status: "open" as const,
    dueDate: "2026-02-01",
  },
];

export const mockAssetDetails = [
  // Site & Real Estate - MA Gillette
  { projectId: 1, category: "Site & Real Estate", subcategory: "Lease", fieldName: "Lease Term", fieldValue: "25 years", isAiExtracted: true, aiConfidence: 0.95 },
  { projectId: 1, category: "Site & Real Estate", subcategory: "Lease", fieldName: "Annual Rent", fieldValue: "$45,000", isAiExtracted: true, aiConfidence: 0.92 },
  { projectId: 1, category: "Site & Real Estate", subcategory: "Lease", fieldName: "Escalation", fieldValue: "2% annually", isAiExtracted: true, aiConfidence: 0.88 },
  { projectId: 1, category: "Site & Real Estate", subcategory: "Land", fieldName: "Land Area", fieldValue: "42 acres", isAiExtracted: false, aiConfidence: null },
  { projectId: 1, category: "Site & Real Estate", subcategory: "Land", fieldName: "Site Owner", fieldValue: "Gillette Family Trust", isAiExtracted: true, aiConfidence: 0.97 },
  
  // Interconnection - MA Gillette
  { projectId: 1, category: "Interconnection", subcategory: "Overview", fieldName: "Type", fieldValue: "Behind-the-Meter", isAiExtracted: false, aiConfidence: null },
  { projectId: 1, category: "Interconnection", subcategory: "Overview", fieldName: "Limit", fieldValue: "12,500 kW", isAiExtracted: true, aiConfidence: 0.94 },
  { projectId: 1, category: "Interconnection", subcategory: "Grid Details", fieldName: "Voltage", fieldValue: "34.5 kV", isAiExtracted: true, aiConfidence: 0.91 },
  { projectId: 1, category: "Interconnection", subcategory: "Grid Details", fieldName: "Utility", fieldValue: "National Grid", isAiExtracted: false, aiConfidence: null },
  { projectId: 1, category: "Interconnection", subcategory: "Grid Details", fieldName: "Substation", fieldValue: "Gillette Sub 115kV", isAiExtracted: true, aiConfidence: 0.89 },
  
  // Technical - MA Gillette
  { projectId: 1, category: "Technical", subcategory: "Equipment", fieldName: "Module Type", fieldValue: "LONGi Hi-MO 6", isAiExtracted: true, aiConfidence: 0.96 },
  { projectId: 1, category: "Technical", subcategory: "Equipment", fieldName: "Module Wattage", fieldValue: "580W", isAiExtracted: true, aiConfidence: 0.94 },
  { projectId: 1, category: "Technical", subcategory: "Equipment", fieldName: "Inverter", fieldValue: "SMA Sunny Central", isAiExtracted: true, aiConfidence: 0.93 },
  { projectId: 1, category: "Technical", subcategory: "Performance", fieldName: "Degradation Rate", fieldValue: "0.5%/year", isAiExtracted: true, aiConfidence: 0.87 },
  { projectId: 1, category: "Technical", subcategory: "Performance", fieldName: "P50 Production", fieldValue: "18,500 MWh/yr", isAiExtracted: true, aiConfidence: 0.91 },
  
  // NY Saratoga
  { projectId: 2, category: "Site & Real Estate", subcategory: "Lease", fieldName: "Lease Term", fieldValue: "30 years", isAiExtracted: true, aiConfidence: 0.96 },
  { projectId: 2, category: "Site & Real Estate", subcategory: "Lease", fieldName: "Annual Rent", fieldValue: "$38,000", isAiExtracted: true, aiConfidence: 0.94 },
  { projectId: 2, category: "Site & Real Estate", subcategory: "Land", fieldName: "Land Area", fieldValue: "28 acres", isAiExtracted: false, aiConfidence: null },
  { projectId: 2, category: "Interconnection", subcategory: "Overview", fieldName: "Type", fieldValue: "Community Solar", isAiExtracted: false, aiConfidence: null },
  { projectId: 2, category: "Interconnection", subcategory: "Overview", fieldName: "Limit", fieldValue: "8,200 kW", isAiExtracted: true, aiConfidence: 0.95 },
  { projectId: 2, category: "Technical", subcategory: "Equipment", fieldName: "BESS Capacity", fieldValue: "16.4 MWh", isAiExtracted: true, aiConfidence: 0.97 },
  { projectId: 2, category: "Technical", subcategory: "Equipment", fieldName: "BESS Duration", fieldValue: "4 hours", isAiExtracted: true, aiConfidence: 0.96 },
];

export const mockSchedulePhases = [
  { id: 1, name: "Feasibility", code: "FEAS", sortOrder: 1 },
  { id: 2, name: "Development", code: "DEV", sortOrder: 2 },
  { id: 3, name: "Notice to Proceed", code: "NTP", sortOrder: 3 },
  { id: 4, name: "Construction", code: "CON", sortOrder: 4 },
  { id: 5, name: "Commercial Operation", code: "COD", sortOrder: 5 },
];

export const mockScheduleItems = [
  // MA Gillette - Development Phase
  { id: 1, projectId: 1, phaseId: 2, name: "Site Control", startDate: "2025-06-01", endDate: "2025-08-15", targetEndDate: "2025-08-01", status: "completed" as const, progress: 100 },
  { id: 2, projectId: 1, phaseId: 2, name: "Interconnection Application", startDate: "2025-07-01", endDate: "2025-09-30", targetEndDate: "2025-09-15", status: "completed" as const, progress: 100 },
  { id: 3, projectId: 1, phaseId: 2, name: "Permitting", startDate: "2025-08-01", endDate: "2026-02-28", targetEndDate: "2026-01-31", status: "in_progress" as const, progress: 65, dependencies: [1] },
  { id: 4, projectId: 1, phaseId: 2, name: "Engineering Design", startDate: "2025-09-01", endDate: "2026-01-31", targetEndDate: "2026-01-15", status: "in_progress" as const, progress: 80, dependencies: [2] },
  { id: 5, projectId: 1, phaseId: 3, name: "EPC Contract Execution", startDate: "2026-01-15", endDate: "2026-02-28", targetEndDate: "2026-02-15", status: "not_started" as const, progress: 0, dependencies: [3, 4] },
  { id: 6, projectId: 1, phaseId: 3, name: "Financing Close", startDate: "2026-02-01", endDate: "2026-03-31", targetEndDate: "2026-03-15", status: "not_started" as const, progress: 0, dependencies: [5] },
  
  // NY Saratoga - NTP Phase
  { id: 7, projectId: 2, phaseId: 2, name: "Site Control", startDate: "2025-03-01", endDate: "2025-05-15", targetEndDate: "2025-05-01", status: "completed" as const, progress: 100 },
  { id: 8, projectId: 2, phaseId: 2, name: "Interconnection Agreement", startDate: "2025-04-01", endDate: "2025-10-31", targetEndDate: "2025-10-15", status: "completed" as const, progress: 100 },
  { id: 9, projectId: 2, phaseId: 3, name: "EPC Contract Execution", startDate: "2025-11-01", endDate: "2026-01-15", targetEndDate: "2025-12-31", status: "overdue" as const, progress: 85, dependencies: [7, 8] },
  { id: 10, projectId: 2, phaseId: 3, name: "Financing Close", startDate: "2025-12-15", endDate: "2026-02-15", targetEndDate: "2026-01-31", status: "in_progress" as const, progress: 40, dependencies: [9] },
  
  // CT Hartford - Construction Phase
  { id: 11, projectId: 3, phaseId: 4, name: "Site Preparation", startDate: "2025-09-01", endDate: "2025-10-31", targetEndDate: "2025-10-15", status: "completed" as const, progress: 100 },
  { id: 12, projectId: 3, phaseId: 4, name: "Foundation Work", startDate: "2025-10-15", endDate: "2025-12-15", targetEndDate: "2025-12-01", status: "completed" as const, progress: 100, dependencies: [11] },
  { id: 13, projectId: 3, phaseId: 4, name: "Racking Installation", startDate: "2025-12-01", endDate: "2026-02-15", targetEndDate: "2026-01-31", status: "in_progress" as const, progress: 70, dependencies: [12] },
  { id: 14, projectId: 3, phaseId: 4, name: "Module Installation", startDate: "2026-01-15", endDate: "2026-03-31", targetEndDate: "2026-03-15", status: "in_progress" as const, progress: 25, dependencies: [13] },
  { id: 15, projectId: 3, phaseId: 5, name: "Commissioning", startDate: "2026-03-15", endDate: "2026-04-30", targetEndDate: "2026-04-15", status: "not_started" as const, progress: 0, dependencies: [14] },
];

export const mockAlerts = [
  { id: 1, projectId: 1, type: "document" as const, severity: "warning" as const, title: "Electrical permit missing", message: "Electrical permit application needs to be submitted for MA - Gillette BTM", isRead: false },
  { id: 2, projectId: 2, type: "schedule" as const, severity: "critical" as const, title: "EPC Contract overdue", message: "EPC Contract Execution for NY - Saratoga CDG 1 is 15 days past target date", isRead: false },
  { id: 3, projectId: 4, type: "document" as const, severity: "critical" as const, title: "Multiple documents missing", message: "NJ - Princeton BESS has 18 missing required documents", isRead: false },
  { id: 4, projectId: 6, type: "rfi" as const, severity: "warning" as const, title: "RFI due this week", message: "Land survey scope negotiation due in 3 days", isRead: true },
  { id: 5, projectId: null, type: "system" as const, severity: "info" as const, title: "Weekly report generated", message: "Portfolio summary report for week of Jan 13 is ready for review", isRead: true },
];

export const mockDiligenceProgress = [
  // MA Gillette
  { projectId: 1, category: "technical" as const, totalItems: 15, completedItems: 12, verifiedItems: 10 },
  { projectId: 1, category: "commercial" as const, totalItems: 12, completedItems: 8, verifiedItems: 6 },
  { projectId: 1, category: "legal" as const, totalItems: 10, completedItems: 5, verifiedItems: 4 },
  // NY Saratoga
  { projectId: 2, category: "technical" as const, totalItems: 15, completedItems: 15, verifiedItems: 14 },
  { projectId: 2, category: "commercial" as const, totalItems: 12, completedItems: 11, verifiedItems: 10 },
  { projectId: 2, category: "legal" as const, totalItems: 10, completedItems: 8, verifiedItems: 7 },
  // CT Hartford
  { projectId: 3, category: "technical" as const, totalItems: 15, completedItems: 15, verifiedItems: 15 },
  { projectId: 3, category: "commercial" as const, totalItems: 12, completedItems: 12, verifiedItems: 11 },
  { projectId: 3, category: "legal" as const, totalItems: 10, completedItems: 9, verifiedItems: 8 },
];

// Helper functions
export function getProjectById(id: number) {
  return mockProjects.find(p => p.id === id);
}

export function getDocumentStatus(projectId: number, docTypeId: number): DocumentStatus {
  return mockDocumentMatrix[projectId]?.[docTypeId] ?? "missing";
}

export function getRfisByProject(projectId: number) {
  return mockRfis.filter(r => r.projectId === projectId);
}

export function getAssetDetailsByProject(projectId: number) {
  return mockAssetDetails.filter(a => a.projectId === projectId);
}

export function getScheduleItemsByProject(projectId: number) {
  return mockScheduleItems.filter(s => s.projectId === projectId);
}

// Portfolio summary calculations
export function getPortfolioSummary() {
  const totalSites = mockProjects.length;
  const totalCapacityMw = mockProjects.reduce((sum, p) => sum + (p.capacityMw || 0), 0);
  const totalCapacityMwh = mockProjects.reduce((sum, p) => sum + (p.capacityMwh || 0), 0);
  const activeAlerts = mockAlerts.filter(a => !a.isRead).length;
  
  // Count documents needing review
  let documentsNeedingReview = 0;
  Object.values(mockDocumentMatrix).forEach(projectDocs => {
    Object.values(projectDocs).forEach(status => {
      if (status === "pending" || status === "missing") {
        documentsNeedingReview++;
      }
    });
  });
  
  // RFI stats
  const openRfis = mockRfis.filter(r => r.status === "open").length;
  const inProgressRfis = mockRfis.filter(r => r.status === "in_progress").length;
  const dueThisWeek = mockRfis.filter(r => {
    const dueDate = new Date(r.dueDate);
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return dueDate <= weekFromNow && r.status !== "resolved";
  }).length;
  
  // High priority risks
  const highPriorityRisks = mockRfis.filter(r => 
    (r.priority === "high" || r.priority === "critical") && r.status !== "resolved"
  ).length;
  
  return {
    totalSites,
    totalCapacityMw,
    totalCapacityMwh,
    activeAlerts,
    documentsNeedingReview,
    rfis: {
      total: mockRfis.length,
      open: openRfis,
      inProgress: inProgressRfis,
      dueThisWeek,
    },
    risks: {
      highPriority: highPriorityRisks,
    },
  };
}
