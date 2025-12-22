# AI Use Case Navigator

A web application for managing AI use cases in an enterprise environment with real-time collaboration, dependency visualization, and configurable property matrices.

## Features

- **Real-time Collaboration**: Multiple users can work simultaneously with changes reflected instantly
- **Use Case Management**: Create, edit, and track AI use cases with configurable properties
- **Dependency Visualization**: Interactive graph showing relationships between use cases and their dependencies (data, knowledge, system)
- **Property Matrix**: Plot use cases on a configurable 2D matrix based on their properties

## Tech Stack

### Backend
- **PocketBase** - Open-source backend with real-time subscriptions, built-in auth, and admin UI

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **TailwindCSS** with Endress+Hauser design system
- **React Flow** for dependency graph visualization
- **D3.js** for property matrix visualization

## Getting Started

### Prerequisites

- Node.js 18+
- PocketBase binary (download from [pocketbase.io](https://pocketbase.io/docs/))

### Setup

1. **Download PocketBase**

   Download the appropriate PocketBase binary for your platform and place it in the `pocketbase/` directory.

2. **Start PocketBase**

   ```bash
   cd pocketbase
   ./pocketbase serve
   ```

   On first run, visit `http://127.0.0.1:8090/_/` to create an admin account.

3. **Create Collections**

   In the PocketBase admin UI, create the following collections:

   - `use_cases`: name (text), description (text), status (select: draft/active/archived), owner (relation to users)
   - `dependencies`: use_case (relation), type (select: data/knowledge/system), name (text), description (text), depends_on (relation to use_cases, optional)
   - `property_definitions`: name (text), type (select: enum/number/text), options (json), order (number)
   - `use_case_properties`: use_case (relation), property (relation), value (text)

4. **Install Frontend Dependencies**

   ```bash
   cd frontend
   npm install
   ```

5. **Configure Environment**

   ```bash
   cp .env.example .env
   # Edit .env if PocketBase is running on a different URL
   ```

6. **Start Development Server**

   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:5173`

## Project Structure

```
ai-use-case-navigator/
├── pocketbase/
│   ├── pocketbase.exe      # PocketBase binary
│   ├── pb_data/            # Database (auto-created)
│   └── pb_migrations/      # Schema migrations
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/     # Header, Sidebar, Layout
│   │   │   ├── ui/         # Button, Card, Input, Select
│   │   │   └── visualizations/
│   │   ├── hooks/          # useRealtime, useRecord
│   │   ├── lib/            # PocketBase client
│   │   ├── pages/          # Route components
│   │   └── types/          # TypeScript types
│   └── package.json
└── README.md
```

## Design System

The application follows the Endress+Hauser design language:

- **Primary Colors**: Deep navy/charcoal (#1a1f2e)
- **Accent Color**: Vibrant teal (#00a3a3)
- **Typography**: Inter font family
- **Components**: Clean cards with subtle shadows, teal CTAs with arrow icons

## License

MIT
