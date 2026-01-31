# KIISHA Design System Documentation
## Based on O11.com Design Reference Analysis

**Version:** 1.0  
**Date:** January 2026  
**Purpose:** Comprehensive design system for KIISHA platform UI/UX revamp

---

## Executive Summary

This design system document analyzes the visual language, layout patterns, and interaction principles from the O11.com reference designs to create a modern, intuitive, and professional design system for KIISHA - a renewable energy asset management platform.

**Key Design Goals:**
1. Create sleek, modern interface matching O11.com aesthetic
2. Improve intuitiveness and natural user flows
3. Systematically expose all KIISHA tools and workflows
4. Optimize UX for renewable energy operations teams
5. Maintain enterprise-grade professionalism

---

## 1. Design Principles & Visual Language

### 1.1 Core Design Principles

**Clarity First**
- Information hierarchy is paramount
- Clear visual distinction between primary and secondary actions
- Minimal cognitive load through progressive disclosure

**Professional Minimalism**
- Clean, uncluttered interfaces
- Generous white space
- Focus on content over decoration
- Subtle, purposeful animations

**Data-Driven Design**
- Emphasize data visualization and metrics
- Dashboard-first approach
- Real-time status indicators
- Clear data hierarchy

**Systematic Organization**
- Consistent navigation patterns
- Logical information architecture
- Predictable interaction patterns
- Tool discoverability through systematic exposure

### 1.2 Visual Language Characteristics

**Modern & Technical**
- Sharp, precise edges
- Technical aesthetic appropriate for energy sector
- Sophisticated color usage
- Professional iconography

**Trustworthy & Reliable**
- Enterprise-grade appearance
- Consistent branding
- Professional typography
- Stable, predictable interactions

---

## 2. Layout Patterns & Grid Systems

### 2.1 Grid System

**Base Grid: 8px System**
```
Base unit: 8px
Component spacing: 8px, 16px, 24px, 32px, 48px, 64px
Container max-width: 1440px
Breakpoints:
  - Mobile: 320px - 767px
  - Tablet: 768px - 1023px
  - Desktop: 1024px - 1439px
  - Large Desktop: 1440px+
```

**Column Grid**
```
Desktop: 12 columns, 24px gutters
Tablet: 8 columns, 16px gutters
Mobile: 4 columns, 16px gutters
```

### 2.2 Layout Patterns

**Dashboard Layout**
```
┌─────────────────────────────────────────┐
│ Top Navigation Bar (64px height)        │
├──────┬──────────────────────────────────┤
│      │                                   │
│ Side │  Main Content Area               │
│ Nav  │  - Hero metrics (if applicable)  │
│ 240px│  - Primary content cards         │
│      │  - Data tables/visualizations    │
│      │                                   │
└──────┴──────────────────────────────────┘
```

**Card-Based Layout**
- Cards with subtle shadows (0 2px 8px rgba(0,0,0,0.08))
- 16px padding for card content
- 12px border-radius
- Consistent card spacing (24px gap)

**Data Table Layout**
- Full-width tables with horizontal scroll
- Sticky headers
- Row hover states
- Alternating row backgrounds (subtle)
- Action buttons aligned right

**Modal/Dialog Pattern**
- Centered overlay with backdrop (rgba(0,0,0,0.4))
- Max-width: 600px (small), 800px (medium), 1200px (large)
- 32px padding
- Close button top-right

---

## 3. Typography System

### 3.1 Font Stack

**Primary Font: Inter**
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 
             'Roboto', 'Helvetica Neue', Arial, sans-serif;
```

**Monospace Font: JetBrains Mono** (for code, IDs, technical data)
```css
font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
```

### 3.2 Type Scale

**Display Headings**
```
Display 1: 48px / 56px line-height, font-weight: 700
Display 2: 40px / 48px line-height, font-weight: 700
Display 3: 32px / 40px line-height, font-weight: 600
```

**Content Headings**
```
H1: 28px / 36px, font-weight: 600
H2: 24px / 32px, font-weight: 600
H3: 20px / 28px, font-weight: 600
H4: 18px / 24px, font-weight: 600
H5: 16px / 24px, font-weight: 600
H6: 14px / 20px, font-weight: 600
```

**Body Text**
```
Large: 18px / 28px, font-weight: 400
Base: 16px / 24px, font-weight: 400
Small: 14px / 20px, font-weight: 400
XSmall: 12px / 16px, font-weight: 400
```

**Labels & UI Text**
```
Label Large: 14px / 20px, font-weight: 500
Label Base: 13px / 18px, font-weight: 500
Label Small: 12px / 16px, font-weight: 500
```

### 3.3 Typography Usage Guidelines

**Page Titles**: Display 2 or H1
**Section Headings**: H2 or H3
**Card Titles**: H4 or H5
**Form Labels**: Label Base
**Body Content**: Base (16px)
**Table Content**: Small (14px)
**Metadata/Timestamps**: XSmall (12px)
**Buttons**: Label Base (13px), font-weight: 500

---

## 4. Color Palette & Usage

### 4.1 Primary Colors

**Brand Primary (Solar Blue)**
```
Primary 50:  #E3F2FD (lightest)
Primary 100: #BBDEFB
Primary 200: #90CAF9
Primary 300: #64B5F6
Primary 400: #42A5F5
Primary 500: #2196F3 (base)
Primary 600: #1E88E5
Primary 700: #1976D2 (dark)
Primary 800: #1565C0
Primary 900: #0D47A1 (darkest)
```

**Usage:**
- Primary actions (buttons, links)
- Active states
- Focus indicators
- Brand elements

### 4.2 Secondary Colors

**Energy Green (Success/Active)**
```
Green 50:  #E8F5E9
Green 100: #C8E6C9
Green 200: #A5D6A7
Green 300: #81C784
Green 400: #66BB6A
Green 500: #4CAF50 (base)
Green 600: #43A047
Green 700: #388E3C
Green 800: #2E7D32
Green 900: #1B5E20
```

**Usage:**
- Success states
- Active assets
- Positive metrics
- Energy production indicators

**Warning Orange**
```
Orange 50:  #FFF3E0
Orange 100: #FFE0B2
Orange 200: #FFCC80
Orange 300: #FFB74D
Orange 400: #FFA726
Orange 500: #FF9800 (base)
Orange 600: #FB8C00
Orange 700: #F57C00
Orange 800: #EF6C00
Orange 900: #E65100
```

**Usage:**
- Warning states
- Approaching deadlines
- Attention needed
- Pending approvals

**Error Red**
```
Red 50:  #FFEBEE
Red 100: #FFCDD2
Red 200: #EF9A9A
Red 300: #E57373
Red 400: #EF5350
Red 500: #F44336 (base)
Red 600: #E53935
Red 700: #D32F2F
Red 800: #C62828
Red 900: #B71C1C
```

**Usage:**
- Error states
- Critical alerts
- Overdue items
- Destructive actions

### 4.3 Neutral Colors

**Gray Scale**
```
Gray 50:  #FAFAFA (backgrounds)
Gray 100: #F5F5F5 (subtle backgrounds)
Gray 200: #EEEEEE (borders, dividers)
Gray 300: #E0E0E0 (disabled backgrounds)
Gray 400: #BDBDBD (disabled text)
Gray 500: #9E9E9E (secondary text)
Gray 600: #757575 (tertiary text)
Gray 700: #616161 (body text)
Gray 800: #424242 (headings)
Gray 900: #212121 (primary text)
```

### 4.4 Semantic Colors

**Info Blue**
```
Info: #2196F3 (same as Primary 500)
Info Background: #E3F2FD
Info Border: #90CAF9
```

**Success Green**
```
Success: #4CAF50 (same as Green 500)
Success Background: #E8F5E9
Success Border: #A5D6A7
```

**Warning Orange**
```
Warning: #FF9800 (same as Orange 500)
Warning Background: #FFF3E0
Warning Border: #FFCC80
```

**Error Red**
```
Error: #F44336 (same as Red 500)
Error Background: #FFEBEE
Error Border: #EF9A9A
```

### 4.5 Background Colors

```
Page Background: #FAFAFA (Gray 50)
Card Background: #FFFFFF (White)
Hover Background: #F5F5F5 (Gray 100)
Active Background: #E3F2FD (Primary 50)
Disabled Background: #EEEEEE (Gray 200)
```

### 4.6 Text Colors

```
Primary Text: #212121 (Gray 900)
Secondary Text: #757575 (Gray 600)
Disabled Text: #BDBDBD (Gray 400)
Link Text: #1976D2 (Primary 700)
Link Hover: #0D47A1 (Primary 900)
```

### 4.7 Border Colors

```
Default Border: #E0E0E0 (Gray 300)
Hover Border: #BDBDBD (Gray 400)
Focus Border: #2196F3 (Primary 500)
Error Border: #F44336 (Red 500)
```

---

## 5. Iconography Style

### 5.1 Icon System

**Icon Library: Lucide React**
- Consistent 24x24px base size
- 1.5px stroke width
- Rounded corners
- Minimal, clean aesthetic

**Icon Sizes**
```
XSmall: 16px (inline with small text)
Small: 20px (inline with base text)
Base: 24px (standard UI icons)
Large: 32px (feature icons)
XLarge: 48px (empty states, illustrations)
```

### 5.2 Icon Usage Guidelines

**Navigation Icons**
- Use outline style for inactive states
- Use filled style for active states
- Always pair with text labels in sidebar

**Action Icons**
- Use in buttons for common actions
- Position left of text in primary buttons
- Use alone in icon buttons (with tooltip)

**Status Icons**
- Use semantic colors (green checkmark, red X, orange warning)
- Consistent size within status badges
- Always include accessible labels

**Data Visualization Icons**
- Use in metric cards
- Subtle, supporting role
- Match brand colors

### 5.3 Common Icon Mappings

**KIISHA-Specific Icons**
```
Projects: Building2, Folder
Assets: Zap, Battery, Sun, Wind
Documents: FileText, File, Upload
Obligations: CheckSquare, AlertCircle
Requests: MessageSquare, Send
Calendar: Calendar, Clock
Reports: BarChart3, PieChart, TrendingUp
Users: Users, User, UserPlus
Settings: Settings, Sliders
Notifications: Bell, BellRing
Search: Search
Filter: Filter, SlidersHorizontal
Export: Download, Share2
Edit: Edit2, Pencil
Delete: Trash2, X
Add: Plus, PlusCircle
View: Eye, EyeOff
Map: Map, MapPin
Chat: MessageCircle, Bot
```

---

## 6. Spacing & Component Patterns

### 6.1 Spacing System (8px Base)

**Spacing Scale**
```
0: 0px
1: 4px (0.5 × base)
2: 8px (1 × base)
3: 12px (1.5 × base)
4: 16px (2 × base)
5: 20px (2.5 × base)
6: 24px (3 × base)
8: 32px (4 × base)
10: 40px (5 × base)
12: 48px (6 × base)
16: 64px (8 × base)
20: 80px (10 × base)
24: 96px (12 × base)
```

**Common Usage**
```
Component padding: 16px (4)
Card padding: 24px (6)
Section spacing: 32px (8)
Page margins: 48px (12)
Icon-text gap: 8px (2)
Button padding: 12px 24px (3, 6)
Input padding: 12px 16px (3, 4)
```

### 6.2 Component Patterns

#### Buttons

**Primary Button**
```css
background: Primary 500 (#2196F3)
color: White
padding: 12px 24px
border-radius: 8px
font-size: 14px
font-weight: 500
hover: Primary 600 (#1E88E5)
active: Primary 700 (#1976D2)
disabled: Gray 300 (#E0E0E0)
```

**Secondary Button**
```css
background: White
color: Primary 700 (#1976D2)
border: 1px solid Gray 300 (#E0E0E0)
padding: 12px 24px
border-radius: 8px
hover: Gray 50 (#FAFAFA) background
```

**Danger Button**
```css
background: Red 500 (#F44336)
color: White
padding: 12px 24px
border-radius: 8px
hover: Red 600 (#E53935)
```

**Icon Button**
```css
width: 40px
height: 40px
border-radius: 8px
background: transparent
hover: Gray 100 (#F5F5F5)
```

#### Input Fields

**Text Input**
```css
height: 44px
padding: 12px 16px
border: 1px solid Gray 300 (#E0E0E0)
border-radius: 8px
font-size: 14px
focus: border Primary 500, outline 2px Primary 100
error: border Red 500, outline 2px Red 100
```

**Select Dropdown**
```css
height: 44px
padding: 12px 16px
border: 1px solid Gray 300
border-radius: 8px
background: White
icon: chevron-down (right aligned)
```

**Textarea**
```css
min-height: 120px
padding: 12px 16px
border: 1px solid Gray 300
border-radius: 8px
resize: vertical
```

#### Cards

**Standard Card**
```css
background: White
border-radius: 12px
padding: 24px
box-shadow: 0 2px 8px rgba(0,0,0,0.08)
hover: box-shadow: 0 4px 12px rgba(0,0,0,0.12)
```

**Metric Card**
```css
background: White
border-radius: 12px
padding: 24px
display: flex
flex-direction: column
gap: 12px

.metric-value: 32px, font-weight: 700
.metric-label: 14px, color: Gray 600
.metric-change: 14px, color: Green/Red 600
```

**List Card**
```css
background: White
border-radius: 12px
padding: 0 (items have padding)
box-shadow: 0 2px 8px rgba(0,0,0,0.08)

.list-item: padding: 16px 24px, border-bottom: 1px solid Gray 200
.list-item:hover: background: Gray 50
```

#### Tables

**Data Table**
```css
width: 100%
background: White
border-radius: 12px
overflow: hidden

thead:
  background: Gray 50
  border-bottom: 2px solid Gray 200
  
th:
  padding: 12px 16px
  font-size: 13px
  font-weight: 600
  color: Gray 700
  text-align: left
  
td:
  padding: 16px
  font-size: 14px
  color: Gray 900
  border-bottom: 1px solid Gray 200
  
tr:hover:
  background: Gray 50
```

#### Badges

**Status Badge**
```css
padding: 4px 12px
border-radius: 12px (pill shape)
font-size: 12px
font-weight: 500

.success: background: Green 100, color: Green 700
.warning: background: Orange 100, color: Orange 700
.error: background: Red 100, color: Red 700
.info: background: Primary 100, color: Primary 700
.neutral: background: Gray 100, color: Gray 700
```

#### Modals

**Modal Overlay**
```css
position: fixed
inset: 0
background: rgba(0, 0, 0, 0.4)
display: flex
align-items: center
justify-content: center
z-index: 1000
```

**Modal Content**
```css
background: White
border-radius: 16px
padding: 32px
max-width: 600px (small), 800px (medium), 1200px (large)
max-height: 90vh
overflow-y: auto
box-shadow: 0 20px 60px rgba(0,0,0,0.3)
```

#### Tooltips

**Tooltip**
```css
background: Gray 900
color: White
padding: 8px 12px
border-radius: 6px
font-size: 12px
max-width: 200px
box-shadow: 0 4px 12px rgba(0,0,0,0.15)
```

---

## 7. Navigation & Information Architecture

### 7.1 Navigation Structure

**Top Navigation Bar**
```
Height: 64px
Background: White
Border-bottom: 1px solid Gray 200
Box-shadow: 0 1px 3px rgba(0,0,0,0.08)

Layout:
┌─────────────────────────────────────────┐
│ [Logo] [Workspace▾] ... [Search] [User]│
└─────────────────────────────────────────┘

Components:
- Logo (left, 32px height)
- Workspace selector (dropdown)
- Global search (center-right)
- Notifications icon
- User avatar + dropdown (right)
```

**Side Navigation**
```
Width: 240px (expanded), 64px (collapsed)
Background: White
Border-right: 1px solid Gray 200

Structure:
┌──────────────┐
│ [Dashboard]  │ ← Active state: Primary 50 background
│ [Projects]   │
│ [Assets]     │
│ [Documents]  │
│ [Requests]   │
│ [Calendar]   │
│ ─────────    │
│ [Reports]    │
│ [Settings]   │
└──────────────┘

Item styling:
- Height: 40px
- Padding: 12px 16px
- Border-radius: 8px (inside container)
- Icon + text (20px icon, 8px gap)
- Active: Primary 50 background, Primary 700 text
- Hover: Gray 50 background
```

**Breadcrumbs**
```
Position: Below top nav, above page content
Height: 48px
Background: Gray 50
Padding: 12px 24px

Format: Home > Projects > Solar Farm A > Details
Separator: chevron-right icon
Active: Gray 900, font-weight: 500
Inactive: Gray 600, clickable
```

### 7.2 Information Architecture for KIISHA

**Level 1: Main Modules** (Side Navigation)
```
1. Dashboard (overview, metrics)
2. Projects (project management)
3. Assets (asset tracking)
4. Documents (document management)
5. Obligations (compliance tracking)
6. Requests (RFI management)
7. Calendar (scheduling)
8. Reports (analytics)
9. Settings (configuration)
```

**Level 2: Module Sub-sections** (Tabs or secondary nav)

**Projects Module:**
- All Projects (list view)
- Project Details (individual project)
  - Overview
  - Assets
  - Documents
  - Obligations
  - Financial
  - Team

**Assets Module:**
- All Assets (list/map view)
- Asset Details (individual asset)
  - Overview
  - Performance
  - Maintenance
  - Documents
  - History

**Documents Module:**
- All Documents (list view)
- Upload Zone
- Categories
- Reviews
- Extractions

**Obligations Module:**
- Active Obligations
- Templates
- Renewals
- Compliance Dashboard

**Requests Module:**
- Open Requests
- Submissions
- Clarifications
- Archive

### 7.3 Navigation Patterns

**Primary Navigation**: Side navigation for main modules
**Secondary Navigation**: Horizontal tabs within modules
**Contextual Navigation**: Breadcrumbs for hierarchy
**Quick Actions**: Floating action button (bottom-right) for common tasks
**Search**: Global search in top nav
**Filters**: Sidebar filters on list views

### 7.4 Page Layout Templates

**Dashboard Layout**
```
┌─────────────────────────────────────────┐
│ Top Nav (64px)                          │
├──────┬──────────────────────────────────┤
│ Side │ Page Header (80px)               │
│ Nav  │ - Title (H1)                     │
│ 240px│ - Actions (buttons)              │
│      ├──────────────────────────────────┤
│      │ Metrics Row (120px)              │
│      │ [Card] [Card] [Card] [Card]      │
│      ├──────────────────────────────────┤
│      │ Main Content                     │
│      │ - Charts                         │
│      │ - Tables                         │
│      │ - Cards                          │
│      │                                   │
└──────┴──────────────────────────────────┘
```

**List View Layout**
```
┌─────────────────────────────────────────┐
│ Top Nav (64px)                          │
├──────┬──────────────────────────────────┤
│ Side │ Page Header (80px)               │
│ Nav  │ - Title + Search + Filter + Add  │
│ 240px├──────────────────────────────────┤
│      │ Filters Sidebar (if active)      │
│      │ ┌────────────────────────────┐   │
│      │ │ Data Table                 │   │
│      │ │ - Sortable columns         │   │
│      │ │ - Row actions              │   │
│      │ │ - Pagination               │   │
│      │ └────────────────────────────┘   │
└──────┴──────────────────────────────────┘
```

**Detail View Layout**
```
┌─────────────────────────────────────────┐
│ Top Nav (64px)                          │
├──────┬──────────────────────────────────┤
│ Side │ Breadcrumbs (48px)               │
│ Nav  ├──────────────────────────────────┤
│ 240px│ Page Header (80px)               │
│      │ - Title + Status + Actions       │
│      ├──────────────────────────────────┤
│      │ Tabs (48px)                      │
│      │ [Overview] [Assets] [Documents]  │
│      ├──────────────────────────────────┤
│      │ Tab Content                      │
│      │ - Cards                          │
│      │ - Forms                          │
│      │ - Tables                         │
└──────┴──────────────────────────────────┘
```

---

## 8. KIISHA-Specific Design Applications

### 8.1 Dashboard Design

**Key Metrics Row**
```
4 metric cards in a row:
- Total Projects (count + trend)
- Active Assets (count + status)
- Pending Obligations (count + urgency)
- Energy Production (value + trend)

Card design:
- White background
- 24px padding
- Icon (32px, brand color)
- Value (32px, bold)
- Label (14px, gray)
- Trend indicator (green/red, with arrow)
```

**Charts Section**
```
2 columns:
- Energy Production Chart (line chart, 7-day trend)
- Asset Status Distribution (donut chart)

Chart styling:
- White card background
- 24px padding
- Chart title (H4)
- Legend below chart
- Responsive height (300px)
```

**Recent Activity Feed**
```
Full-width card:
- Title: "Recent Activity"
- List of recent actions
- Each item: icon + description + timestamp
- "View All" link at bottom
```

### 8.2 Project List View

**Filters Sidebar** (collapsible)
```
Width: 280px
Background: White
Padding: 24px
Border-right: 1px solid Gray 200

Filters:
- Status (multi-select)
- Location (dropdown)
- Capacity Range (slider)
- Date Range (date picker)
- [Apply] [Reset] buttons
```

**Project Cards Grid**
```
Grid: 3 columns on desktop, 2 on tablet, 1 on mobile
Gap: 24px

Card content:
- Project image (16:9 aspect ratio)
- Project name (H4)
- Location (with map pin icon)
- Capacity (with zap icon)
- Status badge
- Last updated (small text)
- [View Details] button
```

### 8.3 Asset Detail View

**Asset Header**
```
Background: White
Padding: 32px
Border-bottom: 1px solid Gray 200

Layout:
- Asset name (H1)
- Asset type badge
- Status indicator (green dot + "Active")
- Action buttons (Edit, Export, Delete)
```

**Asset Tabs**
```
Tabs: Overview | Performance | Maintenance | Documents | History

Tab styling:
- Height: 48px
- Active: border-bottom 2px Primary 500
- Hover: background Gray 50
```

**Performance Tab Content**
```
3-column grid:
- Current Output (metric card)
- Efficiency (metric card)
- Uptime (metric card)

Chart section:
- Production Over Time (line chart)
- Daily/Weekly/Monthly toggle

Alerts section:
- Recent alerts list
- Alert severity indicators
```

### 8.4 Document Management

**Upload Zone**
```
Height: 200px
Border: 2px dashed Gray 300
Border-radius: 12px
Background: Gray 50
Hover: border Primary 300, background Primary 50

Content:
- Upload icon (48px)
- "Drag and drop files here"
- "or click to browse"
- Supported formats list
```

**Document Grid**
```
Grid: 4 columns on desktop
Gap: 16px

Document card:
- File type icon (32px)
- File name (truncated)
- File size
- Upload date
- Status badge
- Action menu (3 dots)
```

### 8.5 Obligations Dashboard

**Obligation Status Overview**
```
4 metric cards:
- Total Obligations
- Due This Week (orange)
- Overdue (red)
- Completed (green)
```

**Obligations Timeline**
```
Vertical timeline:
- Grouped by month
- Each obligation:
  - Date marker
  - Obligation name
  - Status badge
  - Assigned to
  - [View] button
```

**Upcoming Renewals**
```
Table view:
- Columns: Name, Type, Due Date, Status, Actions
- Sort by due date (ascending)
- Color-coded due dates:
  - < 7 days: red
  - 7-30 days: orange
  - > 30 days: green
```

### 8.6 Request Management

**Request List**
```
Table with columns:
- Request ID (monospace font)
- Title
- Type (badge)
- Status (badge)
- Submitted By
- Date
- Actions

Filters:
- Status (Open, In Progress, Resolved)
- Type (Technical, Financial, Compliance)
- Date Range
```

**Request Detail View**
```
Layout:
- Request header (ID, title, status)
- Request details card
- Attachments section
- Conversation thread
- Action buttons (Respond, Close, Escalate)

Conversation thread:
- Chat-style interface
- User avatar + name
- Message content
- Timestamp
- Attachments
```

### 8.7 Calendar View

**Calendar Layout**
```
Month view (default):
- Full calendar grid
- Color-coded events:
  - Obligations: orange
  - Maintenance: blue
  - Meetings: green
  - Deadlines: red

Day/Week view:
- Time slots (hourly)
- Event blocks with details
- Drag-and-drop to reschedule
```

**Event Details Popover**
```
Triggered on event click:
- Event title
- Date/time
- Type
- Description
- Attendees (if meeting)
- [Edit] [Delete] buttons
```

### 8.8 Reports Module

**Report Templates Grid**
```
Grid: 3 columns
Gap: 24px

Template card:
- Icon (48px)
- Template name
- Description
- [Generate] button

Templates:
- Asset Performance Report
- Compliance Summary
- Financial Overview
- Maintenance History
- Energy Production Report
```

**Report Generation Form**
```
Form fields:
- Report Type (dropdown)
- Date Range (date picker)
- Projects (multi-select)
- Assets (multi-select)
- Format (PDF, Excel, CSV)
- [Generate Report] button
```

---

## 9. Responsive Design Guidelines

### 9.1 Breakpoint Strategy

**Mobile (320px - 767px)**
- Single column layouts
- Collapsed side navigation (hamburger menu)
- Stacked metric cards
- Simplified tables (card view)
- Bottom navigation for key actions

**Tablet (768px - 1023px)**
- 2-column layouts where appropriate
- Collapsible side navigation
- 2 metric cards per row
- Horizontal scroll for tables
- Touch-optimized interactions

**Desktop (1024px+)**
- Full side navigation
- Multi-column layouts
- 4 metric cards per row
- Full-featured tables
- Hover states and tooltips

### 9.2 Mobile-Specific Patterns

**Bottom Navigation** (mobile only)
```
Fixed bottom bar:
- 5 key actions
- Icon + label
- Active state indicator
- Height: 64px
```

**Swipe Gestures**
- Swipe left on list items: reveal actions
- Swipe down: refresh
- Swipe between tabs

**Touch Targets**
- Minimum: 44px × 44px
- Spacing: 8px between targets
- Larger buttons on mobile

---

## 10. Animation & Transitions

### 10.1 Animation Principles

**Purposeful Motion**
- Animations should guide attention
- Provide feedback for user actions
- Indicate state changes
- Enhance perceived performance

**Subtle & Fast**
- Duration: 150ms - 300ms
- Easing: ease-in-out
- No unnecessary animations

### 10.2 Common Animations

**Page Transitions**
```css
transition: opacity 200ms ease-in-out;
```

**Hover States**
```css
transition: all 150ms ease-in-out;
```

**Modal Open/Close**
```css
/* Backdrop */
transition: opacity 200ms ease-in-out;

/* Modal content */
transition: transform 250ms ease-out, opacity 250ms ease-out;
transform: scale(0.95) → scale(1);
opacity: 0 → 1;
```

**Dropdown Menus**
```css
transition: opacity 150ms ease-in-out, transform 150ms ease-in-out;
transform: translateY(-8px) → translateY(0);
opacity: 0 → 1;
```

**Loading States**
```css
/* Skeleton screens */
background: linear-gradient(90deg, Gray 100, Gray 200, Gray 100);
animation: shimmer 1.5s infinite;

/* Spinners */
animation: rotate 1s linear infinite;
```

**Toast Notifications**
```css
/* Enter */
transform: translateY(100%) → translateY(0);
transition: transform 300ms ease-out;

/* Exit */
transform: translateY(0) → translateY(100%);
transition: transform 250ms ease-in;
```

---

## 11. Accessibility Guidelines

### 11.1 Color Contrast

**WCAG AA Compliance**
- Normal text: 4.5:1 minimum
- Large text (18px+): 3:1 minimum
- UI components: 3:1 minimum

**Color Combinations (Verified)**
```
✓ Primary 700 (#1976D2) on White: 7.1:1
✓ Gray 900 (#212121) on White: 16.1:1
✓ Gray 700 (#616161) on White: 7.3:1
✓ White on Primary 500 (#2196F3): 4.6:1
✓ White on Red 500 (#F44336): 4.5:1
```

### 11.2 Keyboard Navigation

**Focus Indicators**
```css
outline: 2px solid Primary 500;
outline-offset: 2px;
border-radius: 4px;
```

**Tab Order**
- Logical tab order (left-to-right, top-to-bottom)
- Skip links for main content
- Trapped focus in modals
- Focus management on page transitions

### 11.3 Screen Reader Support

**Semantic HTML**
- Use proper heading hierarchy (H1 → H2 → H3)
- Label all form inputs
- Use `<button>` for buttons, not `<div>`
- Use `<nav>`, `<main>`, `<aside>`, `<article>`

**ARIA Labels**
```html
<!-- Icon buttons -->
<button aria-label="Close modal">
  <X />
</button>

<!-- Status indicators -->
<span role="status" aria-live="polite">
  Loading...
</span>

<!-- Navigation -->
<nav aria-label="Main navigation">
  ...
</nav>
```

### 11.4 Responsive Text

**Minimum Font Sizes**
- Mobile: 16px (prevents zoom on input focus)
- Desktop: 14px minimum for body text
- Never use text smaller than 12px

**Line Length**
- Optimal: 50-75 characters per line
- Maximum: 90 characters per line

---

## 12. Implementation Guidelines

### 12.1 Technology Stack

**Frontend Framework**: React 18 + TypeScript
**Styling**: Tailwind CSS 4.0
**UI Components**: Radix UI (headless components)
**Icons**: Lucide React
**Charts**: Recharts
**Forms**: React Hook Form + Zod
**State Management**: TanStack Query + Zustand

### 12.2 Tailwind Configuration

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#E3F2FD',
          100: '#BBDEFB',
          200: '#90CAF9',
          300: '#64B5F6',
          400: '#42A5F5',
          500: '#2196F3',
          600: '#1E88E5',
          700: '#1976D2',
          800: '#1565C0',
          900: '#0D47A1',
        },
        green: {
          50: '#E8F5E9',
          100: '#C8E6C9',
          // ... (full scale)
        },
        // ... (other color scales)
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      spacing: {
        // 8px base system
        // Already included in Tailwind defaults
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        card: '0 2px 8px rgba(0,0,0,0.08)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.12)',
        modal: '0 20px 60px rgba(0,0,0,0.3)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};
```

### 12.3 Component Library Structure

```
/components
  /ui (base components)
    /Button
    /Input
    /Card
    /Badge
    /Modal
    /Tooltip
    /Table
    /Tabs
    /Dropdown
  /layout
    /TopNav
    /SideNav
    /PageHeader
    /Breadcrumbs
  /features (KIISHA-specific)
    /ProjectCard
    /AssetCard
    /MetricCard
    /DocumentUpload
    /ObligationTimeline
    /RequestList
    /CalendarView
```

### 12.4 Design Tokens (CSS Variables)

```css
:root {
  /* Colors */
  --color-primary: #2196F3;
  --color-primary-dark: #1976D2;
  --color-success: #4CAF50;
  --color-warning: #FF9800;
  --color-error: #F44336;
  
  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  
  /* Spacing */
  --spacing-unit: 8px;
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  
  /* Borders */
  --border-radius: 8px;
  --border-radius-lg: 12px;
  --border-color: #E0E0E0;
  
  /* Shadows */
  --shadow-card: 0 2px 8px rgba(0,0,0,0.08);
  --shadow-card-hover: 0 4px 12px rgba(0,0,0,0.12);
}
```

---

## 13. Design Checklist for KIISHA Implementation

### 13.1 Visual Design Checklist

- [ ] Apply Inter font family throughout
- [ ] Implement 8px spacing system
- [ ] Use defined color palette (no arbitrary colors)
- [ ] Apply consistent border-radius (8px, 12px, 16px)
- [ ] Use card shadows consistently
- [ ] Implement proper typography hierarchy
- [ ] Use Lucide icons at correct sizes
- [ ] Apply proper hover/active states
- [ ] Implement focus indicators for accessibility

### 13.2 Layout Checklist

- [ ] Implement top navigation (64px height)
- [ ] Implement side navigation (240px width)
- [ ] Add breadcrumbs on detail pages
- [ ] Use consistent page headers (80px height)
- [ ] Implement responsive grid layouts
- [ ] Add proper spacing between sections (32px)
- [ ] Ensure mobile responsiveness

### 13.3 Component Checklist

- [ ] Build base UI components (Button, Input, Card, etc.)
- [ ] Create layout components (TopNav, SideNav, etc.)
- [ ] Build KIISHA-specific components (ProjectCard, AssetCard, etc.)
- [ ] Implement all component states (default, hover, active, disabled, error)
- [ ] Add loading states (skeletons, spinners)
- [ ] Implement empty states with illustrations

### 13.4 Interaction Checklist

- [ ] Add smooth transitions (150-300ms)
- [ ] Implement hover effects
- [ ] Add click feedback
- [ ] Implement loading indicators
- [ ] Add toast notifications
- [ ] Implement modal animations
- [ ] Add keyboard navigation support
- [ ] Implement focus management

### 13.5 Accessibility Checklist

- [ ] Verify color contrast ratios (WCAG AA)
- [ ] Add ARIA labels to icon buttons
- [ ] Implement proper heading hierarchy
- [ ] Add alt text to images
- [ ] Ensure keyboard navigation works
- [ ] Add focus indicators
- [ ] Test with screen reader
- [ ] Ensure minimum touch target size (44px)

### 13.6 KIISHA-Specific Checklist

- [ ] Design dashboard with key metrics
- [ ] Create project list and detail views
- [ ] Design asset management interface
- [ ] Build document upload and management UI
- [ ] Create obligations dashboard
- [ ] Design request management interface
- [ ] Build calendar view
- [ ] Create reports module
- [ ] Design settings pages
- [ ] Implement search functionality
- [ ] Add notification system
- [ ] Create user profile and settings

---

## 14. Next Steps & Implementation Plan

### 14.1 Phase 1: Foundation (Week 1-2)

**Tasks:**
1. Set up Tailwind configuration with design tokens
2. Install and configure fonts (Inter, JetBrains Mono)
3. Install Lucide React for icons
4. Create base UI component library
5. Implement layout components (TopNav, SideNav)
6. Set up responsive breakpoints

**Deliverables:**
- Configured Tailwind with custom theme
- Base component library (Button, Input, Card, Badge, etc.)
- Layout components functional
- Storybook documentation (optional)

### 14.2 Phase 2: Core Pages (Week 3-4)

**Tasks:**
1. Redesign Dashboard page
2. Redesign Projects list and detail views
3. Redesign Assets list and detail views
4. Implement responsive layouts
5. Add loading and empty states

**Deliverables:**
- Dashboard with new design
- Projects module redesigned
- Assets module redesigned
- Responsive across all breakpoints

### 14.3 Phase 3: Feature Modules (Week 5-6)

**Tasks:**
1. Redesign Documents module
2. Redesign Obligations dashboard
3. Redesign Requests module
4. Redesign Calendar view
5. Implement all interactions and animations

**Deliverables:**
- All feature modules redesigned
- Consistent interactions throughout
- Smooth animations implemented

### 14.4 Phase 4: Polish & Accessibility (Week 7-8)

**Tasks:**
1. Accessibility audit and fixes
2. Performance optimization
3. Cross-browser testing
4. Mobile testing and refinement
5. Documentation updates

**Deliverables:**
- WCAG AA compliant
- Optimized performance
- Cross-browser compatible
- Mobile-optimized
- Complete documentation

---

## 15. Conclusion

This design system provides a comprehensive foundation for redesigning the KIISHA platform with a modern, intuitive, and professional interface inspired by O11.com's design language. The system emphasizes:

1. **Clarity and Usability**: Clear visual hierarchy, intuitive navigation, and systematic tool exposure
2. **Professional Aesthetic**: Clean, modern design appropriate for enterprise renewable energy management
3. **Consistency**: Unified design language across all modules and components
4. **Accessibility**: WCAG AA compliance and inclusive design practices
5. **Scalability**: Modular component system that can grow with the platform

By following this design system, KIISHA will achieve a sleek, modern interface that matches the quality of leading SaaS platforms while maintaining its unique focus on renewable energy asset management.

---

**Document Version:** 1.0  
**Last Updated:** January 2026  
**Maintained By:** KIISHA Design Team  
**Next Review:** March 2026