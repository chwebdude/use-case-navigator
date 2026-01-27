# Architecture & Design Patterns

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│         Frontend (React + TypeScript)               │
│  ┌───────────────────────────────────────────────┐  │
│  │         React Components (TSX)                │  │
│  │  ├── Pages (DependenciesPage, MatrixPage)    │  │
│  │  ├── Layout (Header, Sidebar, Layout)        │  │
│  │  ├── Modals (FactsheetDetailModal, etc)      │  │
│  │  ├── Visualizations (DependencyGraph, etc)   │  │
│  │  └── UI Library (Button, Card, Modal, etc)   │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │    State & Hooks (Zustand + Custom)           │  │
│  │  ├── useAppSettings (app config)              │  │
│  │  ├── useUser (auth context)                   │  │
│  │  ├── useRealtime (PB subscriptions)           │  │
│  │  └── useChangeLog (audit trail)               │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │   PocketBase Client (REST + WebSocket)        │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                        ↕
              HTTP REST + WebSocket
                        ↕
┌─────────────────────────────────────────────────────┐
│       PocketBase Backend (Node.js)                  │
│  ┌───────────────────────────────────────────────┐  │
│  │    Collections (Data Models)                  │  │
│  │  ├── factsheet_types (use case categories)    │  │
│  │  ├── factsheets (use cases)                   │  │
│  │  ├── dependencies (relationships)             │  │
│  │  ├── property_definitions (fields)            │  │
│  │  ├── property_options (enum values)           │  │
│  │  └── factsheet_properties (values)            │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │    Auth & Permissions                         │  │
│  │  ├── Built-in user management                 │  │
│  │  ├── Rule-based access control                │  │
│  │  └── Real-time subscriptions                  │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                        ↕
                   SQLite Database
```

## Data Model

### Core Collections

#### `factsheet_types`

Defines categories/types of use cases.

```
id, created, updated, name (text), color (text), icon (text), order (number)
```

#### `factsheets`

Main use case records.

```
id, created, updated, name (text), description (text), type (relation → factsheet_types),
status (select: draft|active|archived), responsibility (text), benefits (text),
what_it_does (text), problems_addressed (text), potential_ui (text)
```

#### `dependencies`

Relationships between factsheets.

```
id, created, updated, factsheet (relation → factsheets),
depends_on (relation → factsheets), description (text)
```

#### `property_definitions`

Metadata for custom properties.

```
id, created, updated, name (text), order (number)
```

#### `property_options`

Enumeration values for properties.

```
id, created, updated, property (relation → property_definitions),
value (text), order (number)
```

#### `factsheet_properties`

Values assigned to factsheets for properties.

```
id, created, updated, factsheet (relation → factsheets),
property (relation → property_definitions),
option (relation → property_options)
```

## Frontend Architecture

### Component Hierarchy

```
Layout
├── Header
├── Sidebar
│   └── Navigation Links
└── Main Content
    ├── Dashboard
    ├── FactsheetList
    ├── FactsheetForm / FactsheetDetail
    ├── DependenciesPage
    │   └── DependencyGraph (React Flow)
    ├── MatrixPage
    │   └── PropertyMatrix (D3.js)
    └── SettingsPage
        └── PropertiesEditor
```

### State Management Strategy

**Global State (Zustand)**
* App settings and preferences
* User context and authentication
* Modal open/close states
* Active filters

**Local Component State (React hooks)**
* Form inputs and validation
* Loading states
* Local UI state (expanded/collapsed sections)

**Real-time Data (PocketBase subscriptions)**
* Factsheets list
* Dependencies
* Change logs
* Updates from other users

### Real-time Collaboration Flow

```
User A makes change
         ↓
PocketBase updates database
         ↓
WebSocket broadcasts to all connected clients
         ↓
useRealtime hook receives update
         ↓
State updated via Zustand or React state
         ↓
Component re-renders with latest data
```

## Key Design Patterns

### 1. Hook-Based Data Fetching

```typescript
// useRealtime hook pattern
const unsubscribe = pb.collection('factsheets').subscribe('*', handleUpdate);
return () => unsubscribe(); // Cleanup
```

### 2. Modal Pattern with Zustand

```typescript
// Store modal state centrally
const useModalStore = create(set => ({
  isOpen: false,
  data: null,
  open: (data) => set({ isOpen: true, data }),
  close: () => set({ isOpen: false, data: null })
}));
```

### 3. Expandable Types for Relations

```typescript
// Type expansion for nested data
interface FactsheetExpanded extends Factsheet {
  expand?: {
    type?: FactsheetType;
  };
}
```

### 4. Higher-Order Components for Layout

```typescript
// Layout wrapper for consistent structure
<Layout>
  <YourPageContent />
</Layout>
```

## Database Migrations

Migrations in `pocketbase/pb_migrations/` are versioned and run sequentially:
1. `1703000000_initial_schema.js` - Core collections
2. `1703000001_add_factsheet_fields.js` - Additional fields
3. `1703000002_add_change_log.js` - Audit tracking
4. `1703000003_add_app_settings.js` - Configuration

Each migration is idempotent and should check for existing structures.

## Performance Optimization

### Frontend

* Code splitting via React Router lazy loading
* Component memoization with `React.memo` for pure components
* Virtual scrolling for large lists (if needed)
* Pagination for collection queries (50-100 items/page)

### Real-time Updates

* Batch updates when possible
* Unsubscribe on component unmount
* Filter subscriptions to relevant data

### Visualization

* React Flow handles 100+ nodes efficiently
* D3.js matrix is static (not real-time) for performance
* Use `useMemo` for expensive computations

## Error Handling

* PocketBase client errors wrapped in try-catch
* User-friendly error messages in UI
* Console logging for debugging
* Validation before database operations

## Security Considerations

* PocketBase built-in authentication
* Rule-based access control per collection
* API key management for external integrations
* All data validated on backend
* No sensitive data in localStorage without encryption

## Extensibility

* Component composition for custom features
* Hook-based patterns for new data needs
* Migration system for schema changes
* Zustand stores for new global state
* Custom visualizations can be added to visualizations folder
