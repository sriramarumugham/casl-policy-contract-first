# CASL + ts-rest Contract-First Authorization

**TL;DR**: Define policies in contracts, auto-generate rules, use CASL everywhere.

## Quick Start

```bash
npm install
npm run db:push && npm run db:seed  
npm run dev  # Backend :3001, Frontend :3000
```

## 1. Add Policy to Contract

```typescript
// shared/src/contracts/posts.ts
import { withPolicy } from '../utils/contract-helpers';

deletePost: withPolicy({
  subjects: "Post",
  actions: "delete", 
  conditions: { authorId: "{{userId}}" }
})({
  method: "DELETE",
  path: "/posts/:id",
  // ... rest of contract
})
```

## 2. Backend Auto-Uses It

```typescript
// Auto-generated from contracts
import { APP_ABILITY_RULES } from '@casl-poc/shared/generated/app-rules';
import { createAppAbility } from '@casl-poc/shared/types/casl-types';

const ability = createAppAbility(userRules, { userId: req.userId });
if (!ability.can('delete', 'Post')) throw new Error('Forbidden');
```

## 3. Frontend Uses It

```typescript
// App.tsx - Create ability from JSON rules
import { createTypedAbilityFromJSON } from '@casl-poc/shared';

const ability = createTypedAbilityFromJSON(userRules);

// Pass ability to components
<PostCard post={post} ability={ability} onDelete={deletePost} />
```

## 4. Components Use Ability

```typescript
// components/PostCard.tsx
export function PostCard({ post, ability, onDelete }) {
  return (
    <div>
      <h3>{post.title}</h3>
      <PermissionGate ability={ability} action="delete" subject="Post">
        <button onClick={() => onDelete(post.id)}>Delete</button>
      </PermissionGate>
    </div>
  );
}

// components/PermissionGate.tsx
export function PermissionGate({ ability, action, subject, children }) {
  return ability.can(action, subject) ? <>{children}</> : null;
}
```

## Features

- **Contract-first**: Policies defined with API contracts
- **Auto-generated**: Rules extracted automatically  
- **Type-safe**: Full TypeScript support
- **RawRule support**: Fields, conditions, inverted rules, reasons
- **Template variables**: `{{userId}}` interpolation
- **Swagger integration**: OpenAPI docs included

## Architecture

```
Contract → Generator → JSON → Backend/Frontend
```

1. Define policy in contract with `withPolicy()`
2. Generator extracts rules to JSON
3. Backend/frontend import same rules
4. CASL enforces permissions everywhere# casl-prisma
