# AI Use Case Navigator

This is a vibe coding project. Use with care!

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
- **TailwindCSS** for styling
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
├── .github/
│   └── workflows/          # CI/CD pipelines
├── helm/
│   └── ai-use-case-navigator/  # Helm chart
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
├── Dockerfile              # Multi-stage container build
├── GitVersion.yml          # Semantic versioning config
└── README.md
```

## Docker

Build and run locally with Docker:

```bash
# Build the image
docker build -t ai-use-case-navigator .

# Run the container
docker run -d -p 8080:8080 -v pocketbase-data:/app/pb_data ai-use-case-navigator
```

The application will be available at `http://localhost:8080` and the admin UI at `http://localhost:8080/_/`.

## Kubernetes Deployment

### Using Helm

1. **Add the Helm repository** (if using OCI registry):

   ```bash
   helm pull oci://ghcr.io/chwebdude/charts/ai-use-case-navigator --version <version>
   ```

2. **Install the chart**:

   ```bash
   helm install my-release ./helm/ai-use-case-navigator \
     --set ingress.enabled=true \
     --set ingress.hosts[0].host=my-app.example.com
   ```

3. **Configure values** (create a `values-override.yaml`):

   ```yaml
   ingress:
     enabled: true
     className: nginx
     annotations:
       cert-manager.io/cluster-issuer: letsencrypt-prod
     hosts:
       - host: ai-use-case-navigator.example.com
         paths:
           - path: /
             pathType: Prefix
     tls:
       - secretName: ai-use-case-navigator-tls
         hosts:
           - ai-use-case-navigator.example.com

   persistence:
     enabled: true
     size: 5Gi
   ```

   Then install:

   ```bash
   helm install my-release ./helm/ai-use-case-navigator -f values-override.yaml
   ```

### Helm Chart Values

| Parameter | Description | Default |
|-----------|-------------|---------|
| `replicaCount` | Number of replicas | `1` |
| `image.repository` | Container image repository | `ghcr.io/chwebdude/use-case-navigator` |
| `image.tag` | Container image tag | Chart appVersion |
| `persistence.enabled` | Enable persistent storage | `true` |
| `persistence.size` | PVC size | `1Gi` |
| `ingress.enabled` | Enable ingress | `false` |

## CI/CD

The project uses GitHub Actions for CI/CD with:

- **GitVersion** for automatic semantic versioning
- **Multi-architecture builds** (amd64, arm64)
- **GitHub Container Registry** for container images
- **Helm chart packaging** to OCI registry

### Versioning

Version numbers are automatically determined based on the git history:

- `main` branch: Release versions (e.g., `1.0.0`)
- `develop` branch: Development versions (e.g., `1.1.0-dev.1`)
- `feature/*` branches: Feature versions (e.g., `1.1.0-feature.my-feature.1`)
- `release/*` branches: Release candidates (e.g., `1.1.0-rc.1`)

To create a new release, tag the commit:

```bash
git tag v1.0.0
git push origin v1.0.0
```

## License

MIT
