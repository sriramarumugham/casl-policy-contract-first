# Simplified TS-REST + CASL Policy System

## 🎯 Your Requirements:

- 3 APIs: View posts, Create post, Delete own post
- Auto-generate app policy from contracts (not for Swagger)
- User can edit their policy
- Complex conditions in API contracts
- Frontend UI hidden based on policy comparison

## 1. Enhanced TS-REST Contracts with Policy

```typescript
// shared/contracts/posts.ts
import { initContract } from "@ts-rest/core";
import { z } from "zod";

// Policy metadata - NOT exposed to Swagger
interface PolicyMeta {
  subjects: string[];
  actions: string[];
  conditions?: Record<string, any>;
  description: string;
}

// Helper to add policy metadata (hidden from Swagger)
function withPolicy(policy: PolicyMeta) {
  return (contract: any) => ({
    ...contract,
    __policy: policy, // Hidden from Swagger generation
  });
}

const c = initContract();

export const postsContract = c.router({
  // View any post - no conditions
  viewPosts: withPolicy({
    subjects: ["Post"],
    actions: ["read"],
    description: "View any post",
  })({
    method: "GET",
    path: "/posts",
    responses: {
      200: z.object({
        posts: z.array(
          z.object({
            id: z.number(),
            title: z.string(),
            content: z.string(),
            authorId: z.number(),
          })
        ),
      }),
    },
  }),

  // Create post - no conditions
  createPost: withPolicy({
    subjects: ["Post"],
    actions: ["create"],
    description: "Create a new post",
  })({
    method: "POST",
    path: "/posts",
    body: z.object({
      title: z.string(),
      content: z.string(),
    }),
    responses: {
      201: z.object({
        post: z.object({
          id: z.number(),
          title: z.string(),
          content: z.string(),
          authorId: z.number(),
        }),
      }),
    },
  }),

  // Delete own post - complex condition
  deletePost: withPolicy({
    subjects: ["Post"],
    actions: ["delete"],
    conditions: {
      authorId: "{{userId}}", // Template for user ID
    },
    description: "Delete your own post",
  })({
    method: "DELETE",
    path: "/posts/:id",
    pathParams: z.object({
      id: z.string().transform(Number),
    }),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
  }),
});

// User policy management APIs
export const policyContract = c.router({
  getUserPolicy: {
    method: "GET",
    path: "/policy/user",
    responses: {
      200: z.object({
        policy: z.array(
          z.object({
            action: z.string(),
            subject: z.string(),
            conditions: z.record(z.any()).optional(),
          })
        ),
      }),
    },
  },

  updateUserPolicy: {
    method: "PUT",
    path: "/policy/user",
    body: z.object({
      policy: z.array(
        z.object({
          action: z.string(),
          subject: z.string(),
          conditions: z.record(z.any()).optional(),
        })
      ),
    }),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
  },
});

export const appContract = c.router({
  posts: postsContract,
  policy: policyContract,
});
```

## 2. Policy Extraction Functions

```typescript
// shared/policy/extractor.ts
export interface PolicyRule {
  action: string;
  subject: string;
  conditions?: Record<string, any>;
}

export interface AppPolicy {
  [subject: string]: {
    actions: string[];
    permissions: PolicyRule[];
  };
}

// Extract policies from contracts (hidden from Swagger)
export function extractAppPolicy(contract: any): AppPolicy {
  const appPolicy: AppPolicy = {};

  function traverse(obj: any) {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "object" && value !== null) {
        // Found a route with policy metadata
        if ("__policy" in value) {
          const policy = (value as any).__policy;

          for (const subject of policy.subjects) {
            if (!appPolicy[subject]) {
              appPolicy[subject] = {
                actions: [],
                permissions: [],
              };
            }

            // Add unique actions
            for (const action of policy.actions) {
              if (!appPolicy[subject].actions.includes(action)) {
                appPolicy[subject].actions.push(action);
              }
            }

            // Add permission rules
            for (const action of policy.actions) {
              appPolicy[subject].permissions.push({
                action,
                subject,
                conditions: policy.conditions,
              });
            }
          }
        } else {
          // Recurse into nested objects
          traverse(value);
        }
      }
    }
  }

  traverse(contract);
  return appPolicy;
}

// Create default user policy from app policy
export function createDefaultUserPolicy(appPolicy: AppPolicy): PolicyRule[] {
  const rules: PolicyRule[] = [];

  for (const [subject, config] of Object.entries(appPolicy)) {
    for (const permission of config.permissions) {
      rules.push({
        action: permission.action,
        subject: permission.subject,
        conditions: permission.conditions,
      });
    }
  }

  return rules;
}

// Interpolate template variables in conditions
export function interpolatePolicy(
  policy: PolicyRule[],
  context: { userId: number }
): PolicyRule[] {
  return policy.map((rule) => ({
    ...rule,
    conditions: interpolateConditions(rule.conditions, context),
  }));
}

function interpolateConditions(
  conditions: any,
  context: Record<string, any>
): any {
  if (!conditions) return conditions;

  const result = { ...conditions };
  for (const [key, value] of Object.entries(result)) {
    if (
      typeof value === "string" &&
      value.startsWith("{{") &&
      value.endsWith("}}")
    ) {
      const contextKey = value.slice(2, -2);
      result[key] = context[contextKey];
    }
  }
  return result;
}
```

## 3. Database Schema

```sql
-- Simple user policy storage
CREATE TABLE user_policies (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    policy_json JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- App policy schema (generated from contracts)
CREATE TABLE app_policy_schema (
    id SERIAL PRIMARY KEY,
    schema_json JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 4. Backend Implementation

```typescript
// backend/src/server.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import { PrismaClient } from "@prisma/client";
import { createPrismaAbility, accessibleBy } from "@casl/prisma";
import { AbilityBuilder } from "@casl/ability";
import { appContract } from "../shared/contracts/posts";
import {
  extractAppPolicy,
  createDefaultUserPolicy,
  interpolatePolicy,
} from "../shared/policy/extractor";

const fastify = Fastify({ logger: true });
const prisma = new PrismaClient();

// Generate app policy on startup
const APP_POLICY = extractAppPolicy(appContract);
console.log("Generated App Policy:", JSON.stringify(APP_POLICY, null, 2));

// Store app policy in database
async function storeAppPolicy() {
  await prisma.appPolicySchema.create({
    data: {
      schemaJson: APP_POLICY as any,
    },
  });
}

fastify.register(cors, { origin: true });

// Helper functions
async function getUserPolicy(userId: number) {
  const userPolicy = await prisma.userPolicies.findUnique({
    where: { userId },
  });

  if (!userPolicy) {
    // Return default policy
    return createDefaultUserPolicy(APP_POLICY);
  }

  return userPolicy.policyJson as any[];
}

function createAbilityFromPolicy(policy: any[], userId: number) {
  const { can, build } = new AbilityBuilder(createPrismaAbility);

  const interpolatedPolicy = interpolatePolicy(policy, { userId });

  for (const rule of interpolatedPolicy) {
    can(rule.action, rule.subject, rule.conditions);
  }

  return build();
}

// Middleware to add user ability
fastify.addHook("preHandler", async (request, reply) => {
  const userId = parseInt(request.headers["user-id"] as string) || 1; // Default user

  const policy = await getUserPolicy(userId);
  const ability = createAbilityFromPolicy(policy, userId);

  (request as any).userId = userId;
  (request as any).ability = ability;
});

// API Routes
fastify.get("/api/posts", async (request) => {
  const ability = (request as any).ability;

  try {
    const posts = await prisma.post.findMany({
      where: accessibleBy(ability, "read").Post || {},
    });
    return { posts };
  } catch (error) {
    // If no read access, return empty array
    return { posts: [] };
  }
});

fastify.post("/api/posts", async (request, reply) => {
  const ability = (request as any).ability;
  const userId = (request as any).userId;

  if (!ability.can("create", "Post")) {
    return reply.status(403).send({ error: "Cannot create posts" });
  }

  const { title, content } = request.body as { title: string; content: string };

  const post = await prisma.post.create({
    data: {
      title,
      content,
      authorId: userId,
    },
  });

  return { post };
});

fastify.delete("/api/posts/:id", async (request, reply) => {
  const ability = (request as any).ability;
  const postId = parseInt((request.params as any).id);

  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) {
    return reply.status(404).send({ error: "Post not found" });
  }

  if (!ability.can("delete", "Post", post)) {
    return reply.status(403).send({ error: "Cannot delete this post" });
  }

  await prisma.post.delete({
    where: { id: postId },
  });

  return { success: true };
});

// Policy management routes
fastify.get("/api/policy/user", async (request) => {
  const userId = (request as any).userId;
  const policy = await getUserPolicy(userId);
  return { policy };
});

fastify.put("/api/policy/user", async (request) => {
  const userId = (request as any).userId;
  const { policy } = request.body as { policy: any[] };

  await prisma.userPolicies.upsert({
    where: { userId },
    create: {
      userId,
      policyJson: policy as any,
    },
    update: {
      policyJson: policy as any,
      updatedAt: new Date(),
    },
  });

  return { success: true };
});

// Get app policy schema for frontend
fastify.get("/api/policy/schema", async () => {
  return { schema: APP_POLICY };
});

async function start() {
  try {
    await storeAppPolicy();
    await fastify.listen({ port: 3001, host: "0.0.0.0" });
    console.log("Server running on http://localhost:3001");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
```

## 5. Frontend Implementation

```typescript
// frontend/src/App.tsx
import { useState, useEffect } from "react";
import { createPrismaAbility } from "@casl/prisma";
import { AbilityBuilder } from "@casl/ability";

interface Post {
  id: number;
  title: string;
  content: string;
  authorId: number;
}

interface PolicyRule {
  action: string;
  subject: string;
  conditions?: Record<string, any>;
}

interface AppPolicy {
  [subject: string]: {
    actions: string[];
    permissions: PolicyRule[];
  };
}

// API functions
const api = {
  get: async (url: string) => {
    const res = await fetch(`http://localhost:3001${url}`, {
      headers: { "user-id": "1" }, // Hardcoded user ID for demo
    });
    return res.json();
  },

  post: async (url: string, data: any) => {
    const res = await fetch(`http://localhost:3001${url}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "user-id": "1",
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  put: async (url: string, data: any) => {
    const res = await fetch(`http://localhost:3001${url}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "user-id": "1",
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  delete: async (url: string) => {
    const res = await fetch(`http://localhost:3001${url}`, {
      method: "DELETE",
      headers: { "user-id": "1" },
    });
    return res.json();
  },
};

// Create ability from policy rules
function createAbility(policy: PolicyRule[], userId: number = 1) {
  const { can, build } = new AbilityBuilder(createPrismaAbility);

  for (const rule of policy) {
    const conditions = interpolateConditions(rule.conditions, { userId });
    can(rule.action, rule.subject, conditions);
  }

  return build();
}

function interpolateConditions(
  conditions: any,
  context: Record<string, any>
): any {
  if (!conditions) return conditions;

  const result = { ...conditions };
  for (const [key, value] of Object.entries(result)) {
    if (
      typeof value === "string" &&
      value.startsWith("{{") &&
      value.endsWith("}}")
    ) {
      const contextKey = value.slice(2, -2);
      result[key] = context[contextKey];
    }
  }
  return result;
}

export default function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [userPolicy, setUserPolicy] = useState<PolicyRule[]>([]);
  const [appPolicy, setAppPolicy] = useState<AppPolicy>({});
  const [newPost, setNewPost] = useState({ title: "", content: "" });
  const [showPolicyEditor, setShowPolicyEditor] = useState(false);

  // Create ability from user policy
  const ability = createAbility(userPolicy);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [postsData, policyData, schemaData] = await Promise.all([
        api.get("/api/posts"),
        api.get("/api/policy/user"),
        api.get("/api/policy/schema"),
      ]);

      setPosts(postsData.posts);
      setUserPolicy(policyData.policy);
      setAppPolicy(schemaData.schema);
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  const createPost = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/api/posts", newPost);
      setNewPost({ title: "", content: "" });
      loadData();
    } catch (error) {
      alert("Cannot create post");
    }
  };

  const deletePost = async (postId: number) => {
    try {
      await api.delete(`/api/posts/${postId}`);
      loadData();
    } catch (error) {
      alert("Cannot delete post");
    }
  };

  const updateUserPolicy = async (newPolicy: PolicyRule[]) => {
    try {
      await api.put("/api/policy/user", { policy: newPolicy });
      setUserPolicy(newPolicy);
      loadData(); // Refresh posts based on new policy
    } catch (error) {
      alert("Failed to update policy");
    }
  };

  const togglePermission = (subject: string, action: string) => {
    const hasPermission = userPolicy.some(
      (rule) => rule.subject === subject && rule.action === action
    );

    if (hasPermission) {
      // Remove permission
      const newPolicy = userPolicy.filter(
        (rule) => !(rule.subject === subject && rule.action === action)
      );
      updateUserPolicy(newPolicy);
    } else {
      // Add permission - find it in app policy
      const appPermission = appPolicy[subject]?.permissions.find(
        (p) => p.action === action
      );

      if (appPermission) {
        const newPolicy = [...userPolicy, appPermission];
        updateUserPolicy(newPolicy);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">TS-REST + CASL Demo</h1>
        <button
          onClick={() => setShowPolicyEditor(!showPolicyEditor)}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          {showPolicyEditor ? "Hide" : "Edit"} Policy
        </button>
      </div>

      {/* Policy Editor */}
      {showPolicyEditor && (
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">Edit Your Permissions</h2>

          {Object.entries(appPolicy).map(([subject, config]) => (
            <div key={subject} className="mb-4">
              <h3 className="font-medium mb-2">{subject} Permissions:</h3>
              <div className="grid grid-cols-3 gap-2">
                {config.actions.map((action) => {
                  const hasPermission = userPolicy.some(
                    (rule) => rule.subject === subject && rule.action === action
                  );

                  return (
                    <label key={action} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={hasPermission}
                        onChange={() => togglePermission(subject, action)}
                      />
                      <span className="capitalize">{action}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="mt-4 text-sm text-gray-600">
            <h4 className="font-medium">Current Policy:</h4>
            <pre className="bg-white p-2 rounded text-xs mt-1">
              {JSON.stringify(userPolicy, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Create Post Form - Only show if user can create */}
      {ability.can("create", "Post") && (
        <div className="bg-white border rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">Create New Post</h2>
          <form onSubmit={createPost}>
            <input
              type="text"
              placeholder="Post title"
              value={newPost.title}
              onChange={(e) =>
                setNewPost({ ...newPost, title: e.target.value })
              }
              className="w-full p-2 mb-2 border rounded"
              required
            />
            <textarea
              placeholder="Post content"
              value={newPost.content}
              onChange={(e) =>
                setNewPost({ ...newPost, content: e.target.value })
              }
              className="w-full p-2 mb-2 border rounded h-20"
              required
            />
            <button
              type="submit"
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Create Post
            </button>
          </form>
        </div>
      )}

      {/* Posts List - Only show if user can read */}
      {ability.can("read", "Post") ? (
        <div>
          <h2 className="text-xl font-semibold mb-4">Posts ({posts.length})</h2>
          {posts.length === 0 ? (
            <p className="text-gray-500">No posts found.</p>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <div key={post.id} className="border rounded-lg p-4 bg-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold">{post.title}</h3>
                      <p className="text-gray-700 mt-1">{post.content}</p>
                      <p className="text-sm text-gray-500 mt-2">
                        Author ID: {post.authorId}
                      </p>
                    </div>

                    {/* Delete button - Only show if user can delete this specific post */}
                    {ability.can("delete", "Post", post) && (
                      <button
                        onClick={() => deletePost(post.id)}
                        className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>You don't have permission to view posts.</p>
          <p>Edit your policy to enable post viewing.</p>
        </div>
      )}
    </div>
  );
}
```

## 6. Prisma Schema

```prisma
// backend/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id    Int    @id @default(autoincrement())
  name  String
  posts Post[]
  policy UserPolicies?
}

model Post {
  id       Int    @id @default(autoincrement())
  title    String
  content  String
  authorId Int
  author   User   @relation(fields: [authorId], references: [id])
}

model UserPolicies {
  userId     Int  @id
  user       User @relation(fields: [userId], references: [id])
  policyJson Json
  updatedAt  DateTime @default(now()) @updatedAt
}

model AppPolicySchema {
  id         Int      @id @default(autoincrement())
  schemaJson Json
  createdAt  DateTime @default(now())
}
```

## 7. Key Features

### ✅ **What this achieves:**

1. **API contracts define policies** - Policy metadata hidden from Swagger
2. **Auto-generated app policy** - No manual maintenance
3. **User can edit policy** - Checkboxes for each permission
4. **Complex conditions** - Template variables like `{{userId}}`
5. **Frontend UI hiding** - Buttons appear/disappear based on abilities
6. **Backend authorization** - Same policy enforced on API calls

### ✅ **Simple workflow:**

1. Define API with policy metadata
2. App policy auto-generated on server start
3. User customizes their policy via UI
4. Frontend compares user policy vs app policy
5. UI elements hidden/shown accordingly
6. Backend enforces same policy rules

This minimal implementation gives you the complete TS-REST + CASL integration with user-customizable policies!
