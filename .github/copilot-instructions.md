# GitHub Copilot Instructions

## Project Overview

**AI Use Case Navigator** is a real-time collaborative web application for managing use cases in enterprise environments with dependency visualization and configurable property matrices.

### Tech Stack

- **Backend**: PocketBase (open-source backend with real-time subscriptions)
- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: TailwindCSS
- **Visualization**: React Flow (dependency graphs), D3.js (property matrix)
- **State Management**: Zustand
- **Infrastructure**: Docker + Kubernetes (Helm charts)

---

## Code Style & Conventions

### TypeScript/React

- Use **functional components** with hooks exclusively
- Use **TypeScript strict mode** - always type function parameters and return types
- Component file naming: `PascalCase.tsx` (e.g., `FactsheetDetailModal.tsx`)
- Custom hooks: prefix with `use` (e.g., `useAppSettings.ts`)
- Utility files: `camelCase.ts` (e.g., `pocketbase.ts`)

### Naming Conventions

- Components: PascalCase (e.g., `DependencyGraph`)
- Functions/variables: camelCase (e.g., `fetchFactsheets`)
- Constants: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`)
- React props interfaces: Component name + `Props` (e.g., `ButtonProps`)
- Type imports: use `type` keyword (e.g., `import type { Factsheet }`)

### File Organization

```
src/
├── components/          # Reusable UI components
│   ├── layout/         # Page layout components
│   ├── ui/             # Generic UI components (Button, Card, etc.)
│   └── visualizations/ # Complex visualization components
├── hooks/              # Custom React hooks
├── lib/                # Utilities and external service wrappers
├── pages/              # Full-page components (route handlers)
└── types/              # TypeScript interfaces and types
```

### Components

#### UI Components (`src/components/ui/`)

- Simple, composable, well-typed
- Use props interfaces for all props
- Use TailwindCSS for styling
- Example:

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  // Implementation
}
```

#### Page Components (`src/pages/`)

- Handle routing and data loading
- Use hooks for state management
- Compose UI components
- Names match routes (e.g., `FactsheetList.tsx` for `/factsheets`)

#### Modal Components

- Reusable modal patterns with open/close states
- Pass data and callbacks via props
- Use Zustand store for modal state when appropriate
- File naming: `*Modal.tsx` (e.g., `FactsheetDetailModal.tsx`)

### Styling

- Use TailwindCSS exclusively
- No CSS-in-JS or separate CSS files
- Use semantic color classes: `bg-blue-500`, `text-red-600`
- Responsive classes: `md:`, `lg:`, `sm:` prefixes
- Common utilities:
  - Spacing: `p-4`, `m-2`, `gap-3`
  - Layout: `flex`, `grid`, `absolute`, `relative`
  - Borders: `border`, `rounded-lg`, `shadow-md`

---

## Data & State Management

### PocketBase Integration

- Location: `src/lib/pocketbase.ts`
- Client initialization and type-safe record operations
- Real-time subscriptions via `useRealtime` hook

### PocketBase Migrations

**Location**: `pocketbase/pb_migrations/`

**Naming**: Use Unix timestamp + descriptive name, e.g., `1703000008_add_hidden_fields_to_factsheet_types.js`

**Correct Syntax** (uses `app` parameter):

```javascript
/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Forward migration - making changes
    const collection = app.findCollectionByNameOrId("collection_name");

    // Add field
    collection.fields.add(
      new Field({
        name: "field_name",
        type: "text", // or "json", "editor", "number", etc.
        required: false,
      }),
    );

    app.save(collection);
  },
  (app) => {
    // Rollback - reverse the changes
    const collection = app.findCollectionByNameOrId("collection_name");

    collection.fields.removeByName("field_name");

    app.save(collection);
  },
);
```

**Common Operations**:

- Add field: `collection.fields.add(new Field({ name, type, required }))`
- Remove field: `collection.fields.removeByName("field_name")`
- Update field: Get field by index and modify properties
- Always provide rollback logic in the second function

**Important**: Always use `app` parameter (not `db`), and call `app.save()` to persist changes.

### Zustand Store

- Use for global app state (user settings, modals, filters)
- Store files: `src/hooks/use[StoreName].ts`
- Keep stores focused and small
- Example: `useAppSettings` hook manages app-wide preferences

### TypeScript Types

- All types defined in `src/types/index.ts`
- Extend `RecordModel` from PocketBase for database records
- Use `Expand` types for nested relations (e.g., `FactsheetExpanded`)
- Keep types organized and grouped logically

### Hooks

- Custom hooks in `src/hooks/`
- Reusable logic for data fetching and subscriptions
- Common hooks:
  - `useRealtime`: Subscribe to PocketBase real-time updates
  - `useUser`: Current user context and authentication
  - `useChangeLog`: Track record modifications
  - `useAppSettings`: App configuration and preferences

---

## Common Patterns

### Data Fetching

```typescript
const [data, setData] = useState<FactsheetType[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  pb.collection("factsheets")
    .getList(1, 50)
    .then(setData)
    .catch(setError)
    .finally(() => setLoading(false));
}, []);
```

### Real-time Updates

```typescript
useEffect(() => {
  const unsubscribe = pb.collection("factsheets").subscribe("*", (e) => {
    if (e.action === "create") setData((prev) => [...prev, e.record]);
    if (e.action === "update")
      setData((prev) => prev.map((r) => (r.id === e.record.id ? e.record : r)));
    if (e.action === "delete")
      setData((prev) => prev.filter((r) => r.id !== e.record.id));
  });
  return () => unsubscribe();
}, []);
```

### Modal Management

```typescript
const [isOpen, setIsOpen] = useState(false);
const [selectedId, setSelectedId] = useState<string | null>(null);

return (
  <>
    <button onClick={() => { setSelectedId(id); setIsOpen(true); }}>Open</button>
    <ModalComponent isOpen={isOpen} onClose={() => setIsOpen(false)} />
  </>
);
```

---

## Component Structure Example

```typescript
import { useState, useEffect } from 'react';
import type { Factsheet } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface FactsheetListProps {
  onSelect?: (id: string) => void;
}

export function FactsheetList({ onSelect }: FactsheetListProps) {
  const [factsheets, setFactsheets] = useState<Factsheet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load data
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="grid gap-4">
      {factsheets.map(fs => (
        <Card key={fs.id}>
          <h3 className="font-bold">{fs.name}</h3>
          <Button onClick={() => onSelect?.(fs.id)}>View</Button>
        </Card>
      ))}
    </div>
  );
}
```

---

## Testing Guidelines

- Test components in isolation
- Mock PocketBase responses
- Test user interactions and state changes
- Use descriptive test names
- Focus on behavior, not implementation details

---

## Performance Considerations

- Memoize expensive computations with `useMemo`
- Lazy load pages with React Router
- Unsubscribe from PocketBase real-time on component unmount
- Use React Flow and D3 responsibly for large graphs (100+ nodes)
- Paginate large lists (50-100 items per page)

---

## Common Tasks

### Adding a New Page

1. Create component in `src/pages/NewPage.tsx`
2. Add route in router configuration
3. Add navigation link in sidebar
4. Use existing UI components and hooks

### Adding a New Collection Type

1. Define TypeScript interface in `src/types/index.ts`
2. Create migration in `pocketbase/pb_migrations/` using the correct syntax (see PocketBase Migrations section)
3. Create management component in appropriate folder
4. Update hook if real-time data needed

### Creating a Reusable Component

1. Place in appropriate folder (`ui/`, `components/`, `visualizations/`)
2. Define props interface
3. Use TailwindCSS for styling
4. Export from `src/components/[folder]/index.ts` if needed
5. Add TypeScript types for complex props

---

## AI / Chat Feature ("Talk to Data")

The app includes a chat page (`/chat`) where users can ask natural language questions about their factsheets, dependencies, and properties. It connects to a configurable LLM backend.

### Architecture

- **Page**: `src/pages/ChatPage.tsx` — full chat UI with message history, input, suggestions
- **Chart component**: `src/components/ChatChart.tsx` — D3-based chart rendering (bar, horizontal-bar, pie) embedded in chat responses
- **LLM settings**: stored in `app_settings` PocketBase collection (`llm_endpoint`, `llm_api_key`, `llm_model`), managed via `useAppSettings` hook
- **Settings UI**: LLM Configuration section in `SettingsPage.tsx`

### How It Works

1. On page load, all factsheets, types, dependencies, property definitions, options, and factsheet-property links are fetched from PocketBase
2. A **data context** string is built with a pre-computed summary (exact counts) followed by full listings
3. The data context is injected into a system prompt sent to the LLM along with user messages
4. The LLM endpoint must be **OpenAI-compatible** (`/v1/chat/completions`) — the base URL has this path appended automatically
5. Works with **LiteLLM**, OpenAI, Azure OpenAI, or any compatible proxy

### Chart Visualization

- The system prompt instructs the LLM to include chart data in fenced ` ```chart ` code blocks containing JSON
- Chart JSON format: `{"type": "bar"|"horizontal-bar"|"pie", "title": "...", "data": [{"label": "...", "value": number}]}`
- `parseChartBlocks()` in `ChatChart.tsx` splits assistant messages into text and chart parts
- Text parts render as markdown (via `react-markdown`), chart parts render as D3 SVG visualizations
- Charts are rendered inline within the chat message bubble

### Configuration

Users configure in **Settings → LLM Configuration**:

- **Endpoint URL**: Base URL of the LLM proxy (e.g., `https://litellm.example.com`)
- **API Key**: Bearer token for authentication
- **Model**: Model identifier (e.g., `gpt-4o-mini`)

### Key Design Decisions

- Temperature is set to `0` for deterministic, consistent answers
- Pre-computed summary counts are included in the system prompt to prevent the LLM from miscounting items
- Data is loaded once per session (page load), not per message
- If LLM settings are not configured, the chat page shows a friendly prompt linking to Settings

---

## Important Notes

- Always maintain TypeScript strict mode
- Real-time updates require proper unsubscription
- PocketBase requires migrations for schema changes
- Dependencies between components should be minimal
- UI components should be pure and stateless where possible
