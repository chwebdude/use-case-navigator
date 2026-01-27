# GitHub Copilot Quick Reference

## Common Commands

```bash
# Frontend development
npm run dev           # Start dev server (http://localhost:5173)
npm run build         # Production build
npm run lint          # Check ESLint errors
npm run preview       # Preview production build

# Backend
cd pocketbase
./pocketbase serve    # Start PocketBase (http://127.0.0.1:8090)
```

---

## Component Templates

### Basic Component

```typescript
import type { ComponentNameProps } from '@/types';

interface ComponentNameProps {
  title: string;
  onClick?: () => void;
}

export function ComponentName({ title, onClick }: ComponentNameProps) {
  return (
    <div className="p-4 bg-white rounded-lg">
      <h2 className="font-bold">{title}</h2>
      {onClick && <button onClick={onClick}>Click me</button>}
    </div>
  );
}
```

### Page Component

```typescript
import { useEffect, useState } from 'react';
import type { MyType } from '@/types';
import { Layout } from '@/components/layout';

export function MyPage() {
  const [data, setData] = useState<MyType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pb.collection('my_collection')
      .getList(1, 50)
      .then(result => setData(result.items))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));

    const unsub = pb.collection('my_collection').subscribe('*', e => {
      if (e.action === 'create') setData(p => [...p, e.record]);
      if (e.action === 'update') setData(p => p.map(r => r.id === e.record.id ? e.record : r));
      if (e.action === 'delete') setData(p => p.filter(r => r.id !== e.record.id));
    });

    return () => unsub();
  }, []);

  if (loading) return <Layout><div>Loading...</div></Layout>;
  if (error) return <Layout><div className="text-red-500">Error: {error}</div></Layout>;

  return (
    <Layout>
      <div className="p-4">
        {/* Content */}
      </div>
    </Layout>
  );
}
```

### Custom Hook

```typescript
import { useState, useEffect } from 'react';
import { pb } from '@/lib/pocketbase';
import type { MyType } from '@/types';

export function useMyData() {
  const [data, setData] = useState<MyType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pb.collection('my_collection').getList(1, 50).then(result => setData(result.items)).finally(() => setLoading(false));

    const unsub = pb.collection('my_collection').subscribe('*', e => {
      // Handle updates
    });

    return () => unsub();
  }, []);

  return { data, loading };
}
```

### Modal Component

```typescript
import { Modal } from '@/components/ui';
import { Button } from '@/components/ui';

interface MyModalProps {
  isOpen: boolean;
  onClose: () => void;
  data?: SomeType;
  onSave?: (data: SomeType) => void;
}

export function MyModal({ isOpen, onClose, data, onSave }: MyModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Modal Title</h2>
        {/* Form content */}
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { /* save */ }}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}
```

---

## Styling Quick Ref

### Common Classes

```typescript
// Spacing
p-4, px-4, py-2, m-4, mb-2, gap-3, space-y-2

// Colors
bg-blue-500, text-gray-600, border-red-200, hover:bg-blue-600

// Layout
flex, justify-between, items-center, grid, grid-cols-2

// Size
w-full, h-10, min-h-screen, max-w-lg

// Borders
border, rounded-lg, shadow-md, shadow-none

// Display
hidden, block, invisible, opacity-50

// Responsive
md:grid-cols-2, lg:p-8, sm:text-sm
```

### Responsive Grid

```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Items */}
</div>
```

### Flex Container

```typescript
<div className="flex flex-col gap-4">
  <div>Item 1</div>
  <div>Item 2</div>
</div>
```

---

## PocketBase Quick Ref

### Basic Queries

```typescript
import { pb } from '@/lib/pocketbase';
import type { MyType } from '@/types';

// Get list
await pb.collection('my_collection').getList<MyType>(1, 50);

// Get by ID
await pb.collection('my_collection').getOne<MyType>('id');

// Create
await pb.collection('my_collection').create<MyType>({ name: 'Test' });

// Update
await pb.collection('my_collection').update<MyType>('id', { name: 'Updated' });

// Delete
await pb.collection('my_collection').delete('id');

// Filter
await pb.collection('my_collection').getList(1, 50, {
  filter: "name ~ 'test' && status = 'active'"
});

// Sort & Expand
await pb.collection('my_collection').getList(1, 50, {
  sort: '-created',
  expand: 'relation_field'
});
```

### Real-time Subscriptions

```typescript
// Subscribe to all changes
const unsub = pb.collection('my_collection').subscribe('*', e => {
  console.log(e.action); // 'create', 'update', or 'delete'
  console.log(e.record);
});

// Unsubscribe (CRITICAL!)
return () => unsub();
```

### Authentication

```typescript
// Login
await pb.collection('users').authWithPassword('email', 'password');

// Logout
pb.authStore.clear();

// Check auth
if (pb.authStore.isValid) {
  const user = pb.authStore.record;
}
```

---

## TypeScript Patterns

### Type Definition

```typescript
import type { RecordModel } from 'pocketbase';

export interface MyType extends RecordModel {
  name: string;
  count: number;
  status: 'draft' | 'active';
  created: string; // Inherited from RecordModel
  updated: string; // Inherited from RecordModel
  id: string;      // Inherited from RecordModel
}
```

### Expanded Type (with relations)

```typescript
export interface FactsheetExpanded extends Factsheet {
  expand?: {
    type?: FactsheetType;
    dependencies?: Dependency[];
  };
}
```

### Component Props

```typescript
interface MyComponentProps {
  title: string;
  count?: number;
  onAction?: (id: string) => void;
  children?: React.ReactNode;
}
```

### Function Types

```typescript
type HandleChange = (value: string) => void;
type DataFetcher = () => Promise<MyType[]>;
```

---

## Folder Structure Reference

```
Create new component?    → src/components/[category]/NewComponent.tsx
Create new page?         → src/pages/NewPage.tsx
Create new hook?         → src/hooks/useNewFeature.ts
Create new type?         → Add to src/types/index.ts
Need layout wrapper?     → Import Layout from src/components/layout
Need UI component?       → Import from src/components/ui
Need visualization?      → Create in src/components/visualizations/
```

---

## Debug Commands

```bash
# Check TypeScript errors
npx tsc --noEmit

# Check ESLint
npm run lint

# Clear node_modules and reinstall
rm -rf node_modules
npm install

# Check what's in a PocketBase collection
# Use admin UI: http://127.0.0.1:8090/_/

# Clear browser cache
# DevTools → Application → Storage → Clear Site Data

# Check network requests
# DevTools → Network tab → Look for API calls to http://127.0.0.1:8090
```

---

## Common Mistakes to Avoid

❌ **Don't**
* Forget to unsubscribe from PocketBase
* Mix CSS with React (use TailwindCSS only)
* Leave types untyped
* Use `any` type
* Create CSS files
* Forget cleanup in useEffect
* Update component state after unmount

✅ **Do**
* Always return cleanup function from useEffect with subscriptions
* Type all function parameters and returns
* Import types with `import type` keyword
* Use TailwindCSS utility classes
* Keep components focused and small
* Handle errors with try-catch
* Lazy load routes for performance
* Unsubscribe when component unmounts

---

## File Naming Conventions

| Item | Pattern | Example |
|------|---------|---------|
| Component | PascalCase.tsx | `UserProfile.tsx` |
| Hook | useFeatureName.ts | `useFactsheets.ts` |
| Utility | camelCase.ts | `formatDate.ts` |
| Type file | index.ts | `types/index.ts` |
| Constant | UPPER_SNAKE_CASE | `MAX_ITEMS = 100` |
| CSS class | kebab-case | `class="text-blue-500"` |

---

## Import/Export Patterns

```typescript
// Export from component
export function MyComponent() { }

// Export from barrel file (index.ts)
export { Button } from './Button';
export { Modal } from './Modal';

// Re-export with rename
export { OldName as NewName } from './file';

// Import syntax
import { Component } from '@/components/ui';
import type { MyType } from '@/types';
import { pb } from '@/lib/pocketbase';

// Namespace import
import * as Utils from '@/lib/utils';
```

---

## Testing Your Code

```typescript
// Manual testing checklist
□ Component renders without errors
□ Props passed correctly
□ Click handlers work
□ Real-time updates sync
□ No console errors
□ TypeScript compiles
□ ESLint passes
□ Works on different screen sizes
□ Data persists in PocketBase
```

---

## Getting Help from Copilot

**Good prompts:**
* "Create a component similar to FactsheetList.tsx that shows [details]"
* "Add a hook to fetch data from [collection] with real-time updates"
* "Generate a form component for [type] using the existing Button and Input"
* "Fix this TypeScript error: [error message]"
* "Explain how [pattern] works in this codebase"

**Context to provide:**
* Show similar existing code
* Share type definitions
* Describe what you want vs. what's happening
* Include error messages
* Mention any constraints (style, performance, etc.)

---

## Resources

* VS Code Copilot: Start typing or press `Ctrl+I` for inline editing
* Copilot Chat: `Ctrl+Shift+I` for focused chat
* This guide: `.github/COPILOT_QUICK_REFERENCE.md`
* Full instructions: `.github/copilot-instructions.md`
* Architecture: `.github/ARCHITECTURE.md`
* Development: `.github/DEVELOPMENT.md`
