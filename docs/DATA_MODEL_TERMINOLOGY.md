# KIISHA Data Model Terminology

## Overview

This document clarifies the terminology used in KIISHA's data model to ensure consistency across the platform.

## Key Terms

### Asset (Project-Level)

**Definition:** An **Asset** in KIISHA refers to a **project-level investable unit**—the primary entity that investors, developers, and operators manage.

**Examples:**
- "UMZA Oil Mill Solar+BESS" (5.2 MW solar + 10.4 MWh storage in Lagos, Nigeria)
- "Dangote Cement Ibese Solar" (12.5 MW solar in Ogun, Nigeria)
- "Gbamu Gbamu Mini-Grid" (150 kW community mini-grid)

**Database Table:** `projects`

**Key Fields:**
- `assetClassification` - Type of asset (residential, commercial, industrial, mini-grid, etc.)
- `gridConnectionType` - How the asset connects to the grid (grid-tied, islanded, islandable, etc.)
- `configurationProfile` - Technology configuration (solar_only, solar_bess, hybrid, etc.)
- `networkTopology` - Electrical topology (radial, ring, mesh, star)

### Component / Equipment

**Definition:** **Components** (also called **Equipment**) are the individual hardware units that make up an Asset.

**Examples:**
- Inverters (e.g., SMA Sunny Tripower 50kW)
- Battery modules (e.g., BYD Battery-Box Premium HVS)
- Solar panels (e.g., JA Solar 550W modules)
- Transformers, meters, combiner boxes, etc.

**Database Table:** `assets` (legacy name, contains equipment records)

**Note:** The `assets` table was originally named before the terminology was clarified. It contains equipment-level records, not project-level assets.

## Hierarchy

```
Portfolio
└── Asset (Project)
    ├── Site (Physical Location)
    │   └── System (Functional Grouping: PV, BESS, Genset)
    │       └── Component/Equipment (Individual Hardware)
    └── Classification Metadata
        ├── Asset Classification
        ├── Grid Connection Type
        ├── Configuration Profile
        └── Network Topology
```

## Classification Fields

### Asset Classification
Describes the market segment or use case:
- `residential` - Home solar installations
- `small_commercial` - Small business (<500 kW)
- `large_commercial` - Large commercial (500 kW - 5 MW)
- `industrial` - Industrial facilities (>5 MW)
- `mini_grid` - Standalone community mini-grid
- `mesh_grid` - Interconnected mini-grid network
- `interconnected_mini_grids` - Multiple connected mini-grids
- `grid_connected` - Utility-scale grid-connected

### Grid Connection Type
Describes how the asset connects to electrical infrastructure:
- `grid_tied` - Connected to main grid, no backup
- `islanded` - Completely off-grid
- `islandable` - Grid-connected with islanding capability
- `weak_grid` - Connected to unreliable grid
- `no_grid` - No grid infrastructure available

### Configuration Profile
Describes the technology mix:
- `solar_only` - PV only
- `solar_bess` - PV + Battery storage
- `solar_genset` - PV + Diesel/gas generator
- `solar_bess_genset` - PV + Battery + Generator
- `bess_only` - Battery storage only
- `genset_only` - Generator only
- `hybrid` - Custom hybrid configuration

### Network Topology
Describes the electrical network structure:
- `radial` - Single path from source to loads
- `ring` - Loop configuration with redundancy
- `mesh` - Multiple interconnected paths
- `star` - Central hub with radial branches
- `unknown` - Topology not specified

## UI Mapping

| UI Section | Data Source | Description |
|------------|-------------|-------------|
| Dashboard Charts | `projects` table | Aggregates project-level asset data |
| Asset Portfolio | `projects` table | Lists investable project-level assets |
| Equipment Registry | `assets` table | Lists individual equipment/components |
| O&M Portal | Both | Manages operations across hierarchy |

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `projects.list` | List all project-level assets |
| `projects.listWithFilters` | Filter assets by classification |
| `projects.getClassificationStats` | Get distribution statistics |
| `assets.list` | List equipment/components |
| `assets.create` | Add new equipment to a system |

## Best Practices

1. **When discussing "assets" with stakeholders**, clarify whether you mean project-level assets or equipment
2. **In code comments**, use "project-level asset" or "equipment/component" to be explicit
3. **In UI labels**, use "Asset" for project-level and "Equipment" for hardware
4. **In reports**, aggregate at the project (asset) level for portfolio views
