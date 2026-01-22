# KIISHA Topology Definitions

**Version:** 1.0  
**Last Updated:** January 15, 2026

---

## 1. Overview

In KIISHA, "topology" refers to two distinct electrical architecture concepts:

1. **Coupling Topology** — How components are electrically coupled within a hybrid asset
2. **Distribution Topology** — The network shape for minigrid/mesh grid assets

---

## 2. Coupling Topology

> **Definition:** Coupling topology describes the electrical coupling architecture at the asset/site level, specifically how different generation and storage components are interconnected.

### Enum Values

| Value | Description | When to Use |
|-------|-------------|-------------|
| `AC_COUPLED` | Components connect at the AC bus after individual inverters | Solar+Genset systems, retrofits where BESS is added to existing solar |
| `DC_COUPLED` | Components share a common DC bus before a single inverter | New solar+BESS installations optimized for efficiency |
| `HYBRID_COUPLED` | Mixed AC and DC coupling within the same system | Complex systems with multiple generation sources and storage |
| `UNKNOWN` | Coupling architecture not yet determined | Early-stage projects without detailed design |
| `NOT_APPLICABLE` | Single-technology assets where coupling is irrelevant | Solar-only, genset-only installations |

### UI Behavior

- **Always visible** for all asset types
- Displayed in Asset drawer under "Technical Configuration"
- Available as a filter in the Assets tab

---

## 3. Distribution Topology

> **Definition:** Distribution topology describes the electrical network architecture for minigrid and mesh grid assets, specifically how the distribution network is structured to serve end consumers.

### Enum Values

| Value | Description | When to Use |
|-------|-------------|-------------|
| `RADIAL` | Single path from source to loads, tree-like structure | Most minigrids, simple distribution networks |
| `RING` | Closed loop allowing power flow from either direction | Urban minigrids requiring redundancy |
| `MESH` | Multiple interconnected paths between nodes | Interconnected minigrids, complex networks |
| `STAR` | Central hub with spokes to each load | Small community systems with central generation |
| `TREE` | Hierarchical branching structure | Large minigrids with multiple feeders |
| `UNKNOWN` | Network topology not yet determined | Early-stage minigrid projects |
| `NOT_APPLICABLE` | Not a minigrid/mesh grid asset | C&I solar, grid-connected assets |

### UI Behavior

- **Only visible** when `assetClassification` is one of:
  - `mini_grid`
  - `mesh_grid`
  - `interconnected_mini_grids`
- Hidden for all other asset types (displays as "N/A")
- Filter only appears when classification filter includes minigrid types

---

## 4. Migration from Legacy `networkTopology`

The legacy `networkTopology` field has been replaced:

| Legacy Value | New Coupling | New Distribution |
|--------------|--------------|------------------|
| `radial` | (based on config) | `RADIAL` (if minigrid) |
| `ring` | (based on config) | `RING` (if minigrid) |
| `mesh` | (based on config) | `MESH` (if minigrid) |
| `star` | (based on config) | `STAR` (if minigrid) |
| `unknown` | `UNKNOWN` | `UNKNOWN` (if minigrid) |

The legacy field is retained for backward compatibility but should not be used in new code.

---

## 5. Tooltip/Help Text (In-App)

### Coupling Topology Tooltip
> "Coupling topology describes how generation and storage components are electrically connected. AC-coupled systems use separate inverters for each component, while DC-coupled systems share a common DC bus for higher efficiency."

### Distribution Topology Tooltip
> "Distribution topology describes the network architecture for minigrid assets. Radial networks have a single path from source to loads, while mesh networks have multiple interconnected paths for redundancy."

---

## 6. Current Data Distribution

After migration:

### Coupling Topology
| Value | Count |
|-------|-------|
| NOT_APPLICABLE | 11 |
| DC_COUPLED | 11 |
| HYBRID_COUPLED | 7 |

### Distribution Topology
| Value | Count |
|-------|-------|
| NOT_APPLICABLE | 23 |
| RADIAL | 5 |
| MESH | 1 |

---

## 7. Implementation Notes

1. **Schema Location:** `drizzle/schema.ts` → `projects` table
2. **API Endpoints:** `projects.listWithFilters`, `projects.getClassificationStats`
3. **UI Components:** Asset drawer, filter dropdowns
4. **Conditional Display:** Distribution topology only shown for minigrid classifications
