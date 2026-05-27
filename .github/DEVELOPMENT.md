# Development Guide

## Prerequisites

* **Node.js**: 18+ (check with `node --version`)
* **npm**: 9+ (comes with Node.js)
* **PocketBase**: Download binary from [pocketbase.io](https://pocketbase.io/)
* **Git**: For version control

## Quick Start

### 1. Set Up PocketBase Backend

```bash
# Download PocketBase binary for your OS from https://pocketbase.io/
# Place in pocketbase/ directory

cd pocketbase
./pocketbase serve  # Windows: .\pocketbase.exe serve
```

* Visit `http://127.0.0.1:8090/_/` in browser
* Create admin account on first run
* Collections auto-create via migrations

### 2. Set Up Frontend

```bash
cd frontend
npm install
npm run dev
```

* Frontend runs at `http://localhost:5173`
* Auto-reload on file changes
* TypeScript errors shown in terminal and browser

### 3. Verify Setup

* Navigate to `http://localhost:5173`
* Sign in with test user (create via PocketBase admin)
* Should see dashboard with empty state

---

## Development Workflow

### File Changes & TypeScript

```bash
# Development server with auto-reload and type checking
npm run dev

# Check TypeScript errors without building
npx tsc -b

# Format check with ESLint
npm run lint

# Build for production
npm run build
```

### Adding a New Feature

#### 1. New Page Component

```typescript
// frontend/src/pages/MyNewPage.tsx
import { useEffect, useState } from 'react';
import type { MyType } from '@/types';
import { Layout } from '@/components/layout';

export function MyNewPage() {
  const [data, setData] = useState<MyType[]>([]);

  useEffect(() => {
    // Fetch data
  }, []);

  return (
    <Layout>
      <div className="p-4">
        {/* Content */}
      </div>
    </Layout>
  );
}
```

#### 2. Add TypeScript Types

```typescript
// frontend/src/types/index.ts
export interface MyType extends RecordModel {
  name: string;
  description: string;
}
```

#### 3. Create Custom Hook (if needed)

```typescript
// frontend/src/hooks/useMyData.ts
import { useState, useEffect } from 'react';
import { pb } from '@/lib/pocketbase';
import type { MyType } from '@/types';

export function useMyData() {
  const [data, setData] = useState<MyType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pb.collection('my_collection')
      .getList(1, 50)
      .then(result => setData(result.items))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}
```

#### 4. Add Route

```typescript
// Update your router configuration to include the new page
```

#### 5. Update Navigation

```typescript
// Add link in Sidebar component
<Link to="/my-new-page">My New Page</Link>
```

### Adding a New Collection

#### 1. Create PocketBase Migration

```javascript
// pocketbase/pb_migrations/[timestamp]_add_my_collection.js
migrate((db) => {
    const collection = new Collection({
        id: 'my_collection_id',
        name: 'my_collection',
        type: 'base',
        system: false,
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        options: {}
    });

    return dao.saveCollection(collection);
}, (db) => {
    return dao.deleteCollection('my_collection');
});
```

#### 2. Define TypeScript Interface

```typescript
// frontend/src/types/index.ts
export interface MyCollection extends RecordModel {
  field1: string;
  field2: number;
}
```

#### 3. Create Query/Hook

```typescript
export function useMyCollection() {
  const [items, setItems] = useState<MyCollection[]>([]);

  useEffect(() => {
    pb.collection('my_collection').getList(1, 50).then(setItems);

    const unsubscribe = pb.collection('my_collection').subscribe('*', (e) => {
      // Handle real-time updates
    });

    return () => unsubscribe();
  }, []);

  return items;
}
```

### Styling with TailwindCSS

```typescript
// Use utility classes directly in JSX
<div className="bg-blue-50 p-4 rounded-lg shadow-md">
  <h1 className="text-xl font-bold mb-2">Title</h1>
  <p className="text-gray-600">Description</p>
  <button className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
    Action
  </button>
</div>

// Responsive design
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Items */}
</div>

// Dark mode (if configured)
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  Content
</div>
```

### Testing

```bash
# Run tests (configure test runner in package.json)
npm run test

# Watch mode
npm run test -- --watch
```

**Testing best practices:**
* Test component rendering
* Mock PocketBase calls
* Test user interactions
* Use descriptive test names

---

## Debugging

### Browser DevTools

* Open DevTools: `F12` or `Ctrl+Shift+I`
* Check console for errors
* Use React DevTools extension for component inspection

### VS Code Debugging

Add to `.vscode/launch.json` :

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Chrome",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/frontend/src"
    }
  ]
}
```

### PocketBase Admin UI

* `http://127.0.0.1:8090/_/`
* View/edit collections and data
* Manage users and permissions
* Check API activity

### Common Issues

**Port 5173 already in use:**

```bash
# Kill process using port
# macOS/Linux: lsof -ti:5173 | xargs kill -9
# Windows: netstat -ano | findstr :5173
```

**PocketBase connection refused:**
* Ensure PocketBase is running: `./pocketbase serve`
* Check URL in `src/lib/pocketbase.ts`
* Default: `http://127.0.0.1:8090`

**TypeScript errors but code runs:**
* Run `npm run lint` to see full diagnostics
* Check `tsconfig.json` for strict mode settings
* Type imports must use `import type` syntax

---

## Production Build

```bash
# Build optimized frontend
npm run build

# Preview production build locally
npm run preview
```

Output in `dist/` directory ready for deployment.

### Docker Build

```bash
docker build -t ai-use-case-navigator:latest .
docker run -p 8080:3000 ai-use-case-navigator:latest
```

### Kubernetes Deployment (Helm)

```bash
helm install use-case-navigator ./helm/ai-use-case-navigator \
  -f helm/ai-use-case-navigator/values.yaml
```

---

## Code Standards

### Naming Conventions

* Components: `PascalCase.tsx`
* Hooks: `useComponentName.ts`
* Utils: `camelCase.ts`
* Constants: `UPPER_SNAKE_CASE`
* CSS Classes: `kebab-case`

### Import Organization

```typescript
// 1. React and third-party
import { useState, useEffect } from 'react';
import { pb } from '@/lib/pocketbase';

// 2. Types
import type { MyType } from '@/types';

// 3. Components
import { Button } from '@/components/ui/Button';

// 4. Styles
import '@/index.css';
```

### Component Template

```typescript
import { FC } from 'react';

interface ComponentNameProps {
  title: string;
  onAction?: () => void;
}

const ComponentName: FC<ComponentNameProps> = ({ title, onAction }) => {
  return (
    <div className="p-4">
      <h2 className="font-bold">{title}</h2>
      {onAction && <button onClick={onAction}>Action</button>}
    </div>
  );
};

export default ComponentName;
```

---

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push and create pull request
git push origin feature/my-feature
```

**Commit Message Format:**
* `feat:` new feature
* `fix:` bug fix
* `docs:` documentation
* `style:` formatting
* `refactor:` code restructuring
* `perf:` performance improvement
* `test:` adding tests
* `chore:` maintenance tasks

---

## Resources

* [React Documentation](https://react.dev)
* [TypeScript Handbook](https://www.typescriptlang.org/docs)
* [TailwindCSS Docs](https://tailwindcss.com/docs)
* [PocketBase Docs](https://pocketbase.io/docs)
* [Vite Guide](https://vite.dev/guide)
* [React Router](https://reactrouter.com)
* [Zustand](https://github.com/pmndrs/zustand)
* [React Flow](https://reactflow.dev)
* [D3.js](https://d3js.org)

---

## Getting Help

* Check existing issues on GitHub
* Review similar components for patterns
* Check PocketBase admin UI for data structure
* Use browser DevTools for debugging
* Review TypeScript error messages carefully
