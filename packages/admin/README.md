# Winston Admin Dashboard

Admin interface for managing Winston tenant containers, configurations, and health monitoring.

## Features

- **Tenant Management**: View all tenants with status, tier, and health information
- **File Browser**: Browse and edit files in tenant containers via Winston Sidecar API
- **Live Editing**: Edit MD files (SOUL.md, AGENTS.md, etc.) and OpenClaw config (openclaw.json) with Monaco editor
- **Health Monitoring**: Real-time health status and gateway control
- **Gateway Control**: Restart gateways without SSH access

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Monaco Editor** - Code editor (same as VS Code)
- **Lucide React** - Icons
- **Axios** - HTTP client

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.local.example .env.local
   ```

   Edit `.env.local`:
   ```env
   WINSTON_API_URL=http://localhost:3001
   RAILWAY_API_TOKEN=your_railway_api_token
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

   Admin dashboard will be available at http://localhost:3002

## Architecture

### API Integration

The admin dashboard communicates with:

1. **Winston API** (`/api` routes)
   - Tenant CRUD operations
   - Tenant instance details (includes sidecar tokens)

2. **Winston Sidecar API** (direct to tenant containers)
   - `GET /winston/health` - Health check
   - `GET /winston/files/{path}` - List directory or read file
   - `PUT /winston/files/{path}` - Write file
   - `GET /winston/changes` - Get change log

3. **Setup API** (direct to tenant containers)
   - `POST /setup/api/console/run` - Control gateway (restart, etc.)
   - `GET /setup/api/status` - Get gateway status
   - `GET /healthz` - Public health endpoint

### Authentication

- **Sidecar API**: Bearer token authentication via `WINSTON_SIDECAR_TOKEN`
- **Setup API**: HTTP Basic Auth via `SETUP_PASSWORD`
- Both tokens are fetched from tenant instance records in the database

### File Paths

**Important**: Sidecar API paths are relative to `STATE_DIR` (`/data/.openclaw`)

Examples:
- To edit `/data/.openclaw/openclaw.json` → request `openclaw.json`
- To edit `/data/.openclaw/SOUL.md` → request `SOUL.md`
- To browse `/data/.openclaw/skills/` → request `skills/`

❌ **Don't** use nested paths like `.openclaw/openclaw.json` (results in `/data/.openclaw/.openclaw/openclaw.json`)

## Key Components

### Pages

- **`/`** - Dashboard with tenant list and stats
- **`/tenants/[id]`** - Tenant detail with file browser and editor
- **`/activity`** - Activity log (TODO)
- **`/settings`** - Settings (TODO)

### Components

- **`Sidebar`** - Navigation sidebar
- **`FileEditor`** - Monaco-based file editor modal with save/reset functionality

### API Client (`lib/api.ts`)

- **`getTenants()`** - Fetch all tenants
- **`getTenant(id)`** - Fetch tenant details
- **`getTenantInstance(id)`** - Fetch instance details (includes tokens)
- **`SidecarClient`** - Client for Winston Sidecar API
- **`SetupClient`** - Client for Setup API

### Helper Functions

- **`getSidecarClient(tenantId)`** - Create authenticated sidecar client
- **`getSetupClient(tenantId)`** - Create authenticated setup client

## Usage Example

```typescript
// Get tenant instance and create sidecar client
const sidecar = await getSidecarClient(tenantId);

// Check health
const health = await sidecar.health();
console.log(health.ok); // true/false

// List files
const files = await sidecar.listFiles(''); // root directory
const skills = await sidecar.listFiles('skills'); // skills directory

// Read file
const fileContent = await sidecar.readFile('openclaw.json');
console.log(fileContent.content); // file content as string
console.log(fileContent.metadata); // { path, size, mtime, hash }

// Write file
await sidecar.writeFile('SOUL.md', updatedContent);

// Restart gateway
const setup = await getSetupClient(tenantId);
await setup.restartGateway();
```

## Development

### Adding New Features

1. **New API endpoints**: Add to `packages/api/src/routes/tenants.js`
2. **New API client methods**: Add to `src/lib/api.ts`
3. **New pages**: Create in `src/app/` with TypeScript
4. **New components**: Create in `src/components/`

### Type Definitions

Update `src/types/index.ts` when adding new data structures.

## Deployment

The admin dashboard is a separate Next.js application that can be deployed independently:

1. **Build:**
   ```bash
   npm run build
   ```

2. **Start:**
   ```bash
   npm start
   ```

3. **Deploy to Railway:**
   ```bash
   railway up
   ```

## Security Considerations

- Admin dashboard should be behind authentication (NextAuth integration recommended)
- Sidecar tokens are sensitive - store securely in database
- Setup passwords should be rotated periodically
- Admin actions are logged via the sidecar change tracking

## Troubleshooting

### "Unauthorized" error from sidecar API
- Check that `WINSTON_SIDECAR_TOKEN` is set correctly in tenant container
- Verify token matches what's stored in `tenant_instances.sidecar_token`

### File not found errors
- Remember paths are relative to `STATE_DIR` (`/data/.openclaw`)
- Don't prefix paths with `.openclaw/`

### Gateway restart fails
- Check `SETUP_PASSWORD` is correct
- Verify container is running and accessible
- Check logs: `railway logs --service tenant-{id}`

## Future Enhancements

- [ ] Session transcript viewer
- [ ] Credit usage graphs
- [ ] Real-time logs streaming
- [ ] Bulk operations (restart all gateways)
- [ ] Config diff viewer
- [ ] Backup/restore via admin UI
- [ ] User role-based access control
