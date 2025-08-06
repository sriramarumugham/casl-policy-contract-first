# CASL Prisma POC - TypeScript REST API with Authorization

A complete POC implementation using TypeScript, ts-rest for OpenAPI contracts, Fastify backend, React frontend, and CASL for authorization with Zod validation.

## 🚀 Features

- **3 Core APIs**: View posts, Create posts, Delete own posts
- **Auto-generated app policy** from contracts (hidden from Swagger)
- **User-editable policies** via UI
- **Complex conditions** in API contracts (e.g., `{{userId}}` templates)
- **Frontend UI hiding** based on policy comparison
- **OpenAPI documentation** generation
- **Type-safe contracts** with ts-rest and Zod

## 🏗️ Architecture

```
├── shared/          # Shared contracts and policy logic
│   ├── contracts/   # ts-rest API contracts with policy metadata
│   └── policy/      # Policy extraction and interpolation
├── backend/         # Fastify server with CASL authorization
│   ├── src/         # Server implementation
│   └── prisma/      # Database schema
└── frontend/        # React app with policy editor
    └── src/         # Frontend components
```

## 📋 Prerequisites

- Node.js 18+
- npm

## 🎯 Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Initialize database**:
   ```bash
   npm run db:push
   npm run db:seed
   ```

3. **Start development servers**:
   ```bash
   npm run dev
   ```

   This will start:
   - Backend at http://localhost:3001
   - Frontend at http://localhost:3000
   - Prisma Studio at http://localhost:5555

4. **View documentation**:
   - OpenAPI spec: http://localhost:3001/openapi.json
   - Database UI: http://localhost:5555

## 🔑 Key Components

### Policy System

The system automatically extracts authorization policies from ts-rest contracts:

```typescript
// Contracts include policy metadata (hidden from Swagger)
deletePost: withPolicy({
  subjects: ["Post"],
  actions: ["delete"],
  conditions: {
    authorId: "{{userId}}" // Template variables
  },
  description: "Delete your own post",
})({
  method: "DELETE",
  path: "/posts/:id",
  // ... rest of contract
})
```

### Authorization Flow

1. **App Policy Generation**: Policies are auto-extracted from contracts
2. **User Policy Storage**: Each user can customize their permissions
3. **Policy Interpolation**: Template variables like `{{userId}}` are resolved
4. **Frontend Authorization**: UI elements show/hide based on abilities
5. **Backend Enforcement**: Same policies enforced on API calls

### Demo Workflow

1. **View Policy Editor**: Click "Edit Policy" button
2. **Toggle Permissions**: Check/uncheck permissions for Post actions
3. **See UI Changes**: Buttons appear/disappear based on your policy
4. **Test Authorization**: Try creating/deleting posts with different policies

## 🛠️ Development

### Database Commands

```bash
npm run db:push      # Push schema changes
npm run db:seed      # Seed with sample data
npm run db:studio    # Start Prisma Studio only
```

### Build Commands

```bash
npm run build        # Build all workspaces
```

### Project Structure

- **Shared Package**: Common types and contracts
- **Backend**: Fastify server with Prisma and CASL
- **Frontend**: React SPA with Tailwind CSS

## 🔒 Security Features

- **Policy-based authorization** with CASL
- **Type-safe contracts** prevent runtime errors  
- **Template variables** for dynamic conditions
- **Frontend/backend consistency** with shared contracts

## 📖 API Endpoints

- `GET /api/posts` - View posts (requires read permission)
- `POST /api/posts` - Create post (requires create permission) 
- `DELETE /api/posts/:id` - Delete post (requires delete permission + ownership)
- `GET /api/policy/user` - Get user's policy
- `PUT /api/policy/user` - Update user's policy
- `GET /api/policy/schema` - Get app policy schema

## ✅ Status: **WORKING** 

✅ **Build**: All packages compile successfully  
✅ **Backend**: Fastify server with CASL authorization running on :3001  
✅ **Frontend**: React app with policy editor running on :3000  
✅ **Database**: SQLite with seeded data  
✅ **API**: All endpoints functional with proper authorization  

The POC demonstrates a complete authorization system where:
- Policies are defined alongside API contracts
- Users can customize their permissions via UI
- UI adapts based on user abilities (buttons show/hide)
- Backend enforces the same authorization rules
- OpenAPI spec auto-generated from contracts

Perfect for building secure, user-customizable applications! 🎉