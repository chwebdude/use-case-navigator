# Use Case Navigator - Project Context

## Quick Facts

| Aspect | Details |
|--------|---------|
| **Project Type** | Full-stack web app (vibe coding) |
| **Primary Use** | Managing use cases with real-time collaboration |
| **Frontend** | React 18 + TypeScript + Vite |
| **Backend** | PocketBase (real-time backend) |
| **UI** | TailwindCSS + Lucide Icons |
| **Visualization** | React Flow + D3.js |
| **State** | Zustand + React hooks |
| **Database** | SQLite (via PocketBase) |
| **Infrastructure** | Docker + Kubernetes (Helm) |
| **Node Version** | 18+ |
| **Main Command** | `npm run dev` (frontend) + `./pocketbase serve` (backend) |

---

## Project Goals

01. **Real-time Collaboration** - Multiple users updating simultaneously
02. **Use Case Management** - Create, edit, organize AI use cases
03. **Dependency Visualization** - Interactive graphs showing relationships
04. **Property Matrix** - 2D plotting of use cases by configurable properties
05. **Enterprise-Ready** - Authentication, audit logs, Kubernetes support

---

## Core Concepts

### Factsheets

Main entity representing an AI use case.
* **Fields**: name, description, type, status (draft/active/archived)
* **Optional**: responsibility, benefits, what_it_does, problems_addressed, potential_ui
* **Relations**: factsheet_type (category), dependencies, properties

### Dependencies

Relationships between factsheets.
* **Types**: data, knowledge, system
* **Direction**: One factsheet depends on another
* **Purpose**: Map technology landscape and understand impact

### Property Matrix

2D visualization for analyzing use cases.
* **Axes**: User-defined properties (e.g., Complexity vs. Value)
* **Purpose**: Strategic planning and portfolio analysis
* **Data**: Property values assigned to factsheets

### Real-time Collaboration

When any user makes a change:
01. Update sent to PocketBase
02. Database records updated
03. WebSocket broadcast to all connected clients
04. UIs update via subscription handlers
05. No page refresh needed

---

## File Structure Deep Dive

### Frontend ( `/frontend` )

```
src/
├── main.tsx                    # App entry point
├── App.tsx                     # Root component with routes
├── index.css                   # Global styles
│
├── components/                 # Reusable components
│   ├── layout/
│   │   ├── Header.tsx         # Top navigation bar
│   │   ├── Sidebar.tsx        # Left navigation menu
│   │   ├── Layout.tsx         # Main layout wrapper
│   │   └── index.ts           # Barrel export
│   │
│   ├── ui/                     # Generic UI components
│   │   ├── Button.tsx         # Styled button with variants
│   │   ├── Card.tsx           # Card container component
│   │   ├── Input.tsx          # Text input with validation
│   │   ├── Modal.tsx          # Dialog wrapper
│   │   ├── Select.tsx         # Dropdown selector
│   │   ├── Badge.tsx          # Status/tag badge
│   │   └── index.ts           # Barrel export
│   │
│   └── visualizations/        # Complex visualization components
│       ├── DependencyGraph.tsx # React Flow graph editor
│       ├── PropertyMatrix.tsx  # D3.js 2D matrix plot
│       └── index.ts           # Barrel export
│
├── hooks/                      # Custom React hooks
│   ├── useRealtime.ts         # Subscribe to PocketBase updates
│   ├── useUser.ts             # Current user context
│   ├── useChangeLog.ts        # Audit trail tracking
│   ├── useAppSettings.ts      # Global app configuration
│   └── [useModals, etc]       # Feature-specific hooks
│
├── lib/                        # Utility libraries
│   └── pocketbase.ts          # PocketBase client initialization
│
├── pages/                      # Full-page components (routes)
│   ├── Dashboard.tsx          # Home/overview page
│   ├── FactsheetList.tsx      # Browse all use cases
│   ├── FactsheetDetail.tsx    # View single use case
│   ├── FactsheetForm.tsx      # Create/edit use case
│   ├── DependenciesPage.tsx   # Dependency graph view
│   ├── MatrixPage.tsx         # Property matrix view
│   ├── PropertiesEditor.tsx   # Manage custom properties
│   ├── SettingsPage.tsx       # App settings
│   └── index.ts               # Barrel export
│
└── types/                      # TypeScript interfaces
    └── index.ts               # All type definitions
```

### Backend ( `/pocketbase` )

```
pocketbase/
├── pocketbase[.exe]           # PocketBase binary
├── pb_data/
│   ├── types.d.ts            # Generated TypeScript types
│   └── [database files]       # SQLite data
│
├── pb_migrations/             # Version-controlled schema changes
│   ├── 1703000000_initial_schema.js
│   ├── 1703000001_add_factsheet_fields.js
│   ├── 1703000002_add_change_log.js
│   └── 1703000003_add_app_settings.js
│
└── [hooks, plugins, etc]      # Custom backend code (optional)
```

### Infrastructure ( `/helm` )

```
helm/
└── ai-use-case-navigator/
    ├── Chart.yaml             # Helm chart metadata
    ├── values.yaml            # Configurable values
    └── templates/
        ├── deployment.yaml    # Kubernetes Deployment
        ├── service.yaml       # Kubernetes Service
        ├── ingress.yaml       # Ingress routing
        ├── secret.yaml        # Secret management
        ├── pvc.yaml          # Persistent volume
        ├── hpa.yaml          # Horizontal pod autoscaler
        ├── pdb.yaml          # Pod disruption budget
        └── [others]
```

---

## Key Technologies

### React 18

* Latest React with automatic batching
* Concurrent features available
* Strict mode for development warnings

### TypeScript

* Strict mode enabled (critical!)
* All functions typed
* RecordModel base type from PocketBase

### TailwindCSS v4

* Utility-first CSS framework
* No separate CSS files
* Real-time compilation with Vite plugin

### PocketBase

* Self-hosted backend alternative to Firebase
* Real-time subscriptions via WebSocket
* Admin UI built-in
* SQLite database

### React Flow

* Interactive node-based editor
* Handles 100+ nodes efficiently
* Customizable node and edge rendering

### D3.js

* Data-driven DOM manipulation
* 2D visualization (property matrix)
* Scales, axes, and transforms

### Zustand

* Minimal state management
* No boilerplate
* Easy to use with hooks

---

## Data Flow Patterns

### Creating a Use Case

```
User Form Input
     ↓
Form Validation (client-side)
     ↓
pb.collection('factsheets').create(data)
     ↓
PocketBase validates (server-side)
     ↓
SQLite INSERT
     ↓
WebSocket broadcast to all clients
     ↓
useRealtime subscribers notified
     ↓
Component state updated
     ↓
UI re-renders
```

### Viewing Dependencies

```
Load Page
     ↓
Fetch all factsheets + dependencies
     ↓
Subscribe to real-time updates
     ↓
Build graph data structure
     ↓
Pass to React Flow component
     ↓
User interacts with graph
     ↓
Update dependencies
     ↓
(repeat cycle)
```

### Editing Properties

```
Open PropertiesEditor
     ↓
Display available properties
     ↓
User selects/modifies values
     ↓
Save factsheet_properties records
     ↓
Real-time update propagates
     ↓
PropertyMatrix recalculates
     ↓
Chart re-renders
```

---

## Common Component Patterns

### Page Component Template

```typescript
// Must be in pages/ folder
// Handles routing and data loading
// Composes UI and visualization components

export function MyPage() {
  const [data, setData] = useState<MyType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pb.collection('collection').getList().then(setData).finally(() => setLoading(false));

    const unsub = pb.collection('collection').subscribe('*', handleUpdate);
    return () => unsub();
  }, []);

  return <Layout>{/* content */}</Layout>;
}
```

### Modal Component Template

```typescript
// File naming: *Modal.tsx
// Props include isOpen, onClose, and data

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  data?: SomeType;
}

export function MyModal({ isOpen, onClose, data }: ModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {/* Modal content */}
    </Modal>
  );
}
```

### Hook Template

```typescript
// File naming: use[Name].ts in hooks/
// Return values and functions needed

export function useMyFeature() {
  const [state, setState] = useState();

  useEffect(() => {
    // Setup
    return () => {
      // Cleanup (critical for subscriptions!)
    };
  }, []);

  return { state };
}
```

---

## Important Reminders

01. **Always unsubscribe** from PocketBase subscriptions in useEffect cleanup
02. **Type everything** - TypeScript strict mode is mandatory
03. **Use TailwindCSS** - No CSS files or CSS-in-JS
04. **Keep components small** - Under 200 lines each is ideal
05. **Test real-time** - Always verify changes sync across tabs/users
06. **Handle errors** - Don't silently fail, show user feedback
07. **Lazy load** - Use React Router for code splitting
08. **PocketBase migrations** - Always create migrations, never manual schema changes

---

## Where to Find Things

| Question | Location |
|----------|----------|
| How do I...? | Check [DEVELOPMENT.md](.github/DEVELOPMENT.md) |
| What's the component structure? | Look at [ARCHITECTURE.md](.github/ARCHITECTURE.md) |
| What patterns should I use? | See [copilot-instructions.md](.github/copilot-instructions.md) |
| What's the database schema? | Run PocketBase admin UI or check migrations |
| How do I add a new page? | Create in `src/pages/` , add route in App.tsx, add nav link |
| How do I make it real-time? | Use `useRealtime` hook with PocketBase subscribe |
| What about styling? | TailwindCSS only - use utility classes in JSX |
| How do tests work? | Check package.json for test commands |
| What about deployment? | See helm/ charts and Dockerfile |

---

## Next Steps for New Developers

01. Read [copilot-instructions.md](.github/copilot-instructions.md)
02. Read [ARCHITECTURE.md](.github/ARCHITECTURE.md)
03. Follow [DEVELOPMENT.md](.github/DEVELOPMENT.md) setup steps
04. Explore existing components in `src/components/`
05. Read one complete page component (e.g., FactsheetList.tsx)
06. Try adding a simple UI component
07. Try adding a new hook using existing patterns
08. Check PocketBase admin UI to understand data
09. Build a new feature following established patterns
10. Ask Copilot about anything unclear!

---

## Performance Targets

* Page load: < 2s
* Real-time update latency: < 500ms
* Graph render (100 nodes): < 1s
* Matrix render: < 500ms
* No memory leaks on subscription cleanup

---

## Copilot Integration Notes

This project is optimized for GitHub Copilot:
* Clear patterns for Copilot to follow
* Consistent naming conventions
* Type-safe patterns
* Well-documented architecture
* Examples in every component folder

When asking Copilot to:
* **Generate components**: Reference similar components in the codebase
* **Write hooks**: Show existing hooks as examples
* **Create pages**: Point to Dashboard.tsx or FactsheetList.tsx as patterns
* **Fix issues**: Share error messages and relevant type definitions
* **Add features**: Describe the feature and reference existing similar features
