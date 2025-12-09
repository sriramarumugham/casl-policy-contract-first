import Fastify from "fastify";
import cors from "@fastify/cors";
import { PrismaClient } from "@prisma/client";
import { initServer } from "@ts-rest/fastify";
import { generateOpenApi } from "@ts-rest/open-api";
import {
  appContract,
  APP_ABILITY_RULES,
  createAppAbility,
  SUBJECTS,
  ACTIONS,
  AppAbility,
} from "@casl-poc/shared";

const fastify = Fastify({ logger: true });
const prisma = new PrismaClient();

console.log("🎯 Contract-First CASL Backend");
console.log("📋 Subjects:", SUBJECTS);
console.log("🎯 Actions:", ACTIONS);
console.log("📜 Rules:", APP_ABILITY_RULES.length, "rules loaded");

// Simple API: Get user's ability rules
async function getUserAbilityRules(userId: number) {
  const userPolicy = await prisma.userPolicies.findUnique({
    where: { userId },
  });

  if (!userPolicy) {
    // Default: all app rules
    return APP_ABILITY_RULES;
  }

  return JSON.parse(userPolicy.policyJson);
}

declare module "fastify" {
  interface FastifyRequest {
    userId: number;
    ability: AppAbility;
  }
}

fastify.register(cors, {
  origin: [
    'http://localhost:3000',
    'https://casl-policy-contract-first-frontend-lime.vercel.app'
  ],
  credentials: true
});

fastify.addHook("preHandler", async (request, reply) => {
  const userId = parseInt(request.headers["user-id"] as string) || 1;

  const userRules = await getUserAbilityRules(userId);
  const ability = createAppAbility(userRules, { userId });

  request.userId = userId;
  request.ability = ability;
});

const s = initServer();

const router = s.router(appContract as any, {
  posts: {
    viewPosts: async ({ request }) => {
      const ability = request.ability;

      try {
        if (!ability.can("read", "Post")) {
          return { status: 200, body: { posts: [] } };
        }

        const posts = await prisma.post.findMany({
          include: {
            author: true,
          },
        });

        return {
          status: 200,
          body: {
            posts: posts.map((p: any) => ({
              id: p.id,
              title: p.title,
              content: p.content,
              authorId: p.authorId,
            })),
          },
        };
      } catch (error) {
        console.error("Error fetching posts:", error);
        return { status: 200, body: { posts: [] } };
      }
    },

    createPost: async ({ body, request }) => {
      const ability = request.ability;
      const userId = request.userId;

      if (!ability.can("create", "Post")) {
        return {
          status: 403 as any,
          body: { error: "Cannot create posts" } as any,
        };
      }

      const post = await prisma.post.create({
        data: {
          title: body.title,
          content: body.content,
          authorId: userId,
        },
      });

      return {
        status: 201,
        body: {
          post: {
            id: post.id,
            title: post.title,
            content: post.content,
            authorId: post.authorId,
          },
        },
      };
    },

    deletePost: async ({ params, request }) => {
      const ability = request.ability;
      const postId = Number((params as any).id);

      const post = await prisma.post.findUnique({
        where: { id: postId },
      });

      if (!post) {
        return {
          status: 404 as any,
          body: { error: "Post not found" } as any,
        };
      }

      // Use CASL directly - no custom functions!
      if (!ability.can("delete", "Post", post as any)) {
        return {
          status: 403 as any,
          body: { error: "Cannot delete this post" } as any,
        };
      }

      await prisma.post.delete({
        where: { id: postId },
      });

      return {
        status: 200,
        body: { success: true },
      };
    },
  },

  policy: {
    getUserPolicy: async ({ request }) => {
      const userId = request.userId;
      const rules = await getUserAbilityRules(userId);
      return {
        status: 200,
        body: { policy: rules },
      };
    },

    updateUserPolicy: async ({ body, request }) => {
      const userId = request.userId;

      await prisma.userPolicies.upsert({
        where: { userId },
        create: {
          userId,
          policyJson: JSON.stringify(body.policy),
        },
        update: {
          policyJson: JSON.stringify(body.policy),
          updatedAt: new Date(),
        },
      });

      return {
        status: 200,
        body: { success: true },
      };
    },

    getAppPolicySchema: async () => {
      // Convert to expected format for API compatibility
      const schemaRecord: Record<string, any> = {};

      for (const subject of SUBJECTS) {
        const subjectRules = APP_ABILITY_RULES.filter(
          (r) => r.subject === subject
        );
        const actions = [...new Set(subjectRules.map((r) => r.action))];
        schemaRecord[subject] = {
          actions,
          permissions: subjectRules,
        };
      }

      return {
        status: 200,
        body: { schema: schemaRecord },
      };
    },
  },
});

fastify.register(
  async function (fastify) {
    s.registerRouter(appContract, router, fastify);
  },
  { prefix: "/api" }
);

const openApiDocument = generateOpenApi(
  appContract,
  {
    info: {
      title: "Contract-First CASL API",
      version: "1.0.0",
      description: `
# 🎯 Contract-First CASL API

A fully type-safe authorization API built with:
- **ts-rest** for contract-first development
- **CASL** for flexible authorization
- **TypeScript** for end-to-end type safety

## 🔒 Authorization

This API uses CASL (Condition-Based Access Control Library) for permissions:

- **Subjects**: Post, User, Comment
- **Actions**: create, read, update, delete
- **Conditions**: Dynamic rules like \`{ authorId: "{{userId}}" }\`

### Headers Required:
- \`user-id\`: User ID for authorization context

## 📋 Permission Examples:

**Read Posts**: \`{ action: "read", subject: "Post" }\`
**Create Posts**: \`{ action: "create", subject: "Post" }\`  
**Delete Own Posts**: \`{ action: "delete", subject: "Post", conditions: { authorId: "{{userId}}" } }\`

The API automatically enforces these permissions on all endpoints.
      `,
      contact: {
        name: "CASL + ts-rest Demo",
        url: "https://casl.js.org",
      },
    },
    servers: [
      {
        url: "http://localhost:3001/api",
        description: "Development server",
      },
    ],
    tags: [
      {
        name: "posts",
        description: "Post management with CASL authorization",
      },
      {
        name: "policy",
        description: "CASL policy management endpoints",
      },
    ],
  },
  {
    setOperationId: true,
  }
);

// Serve OpenAPI JSON
fastify.get("/openapi.json", () => openApiDocument);

async function start() {
  try {
    // Register Swagger plugin with our generated OpenAPI document
    await fastify.register(require("@fastify/swagger"), {
      openapi: openApiDocument,
    });

    // Then register Swagger UI
    await fastify.register(require("@fastify/swagger-ui"), {
      routePrefix: "/docs",
      uiConfig: {
        docExpansion: "full",
        deepLinking: false,
      },
    });

    await fastify.listen({ port: 3001, host: "0.0.0.0" });
    console.log("🚀 Server running on http://localhost:3001");
    console.log(
      "📖 OpenAPI spec available at http://localhost:3001/openapi.json"
    );
    console.log("📚 Swagger UI available at http://localhost:3001/docs");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
