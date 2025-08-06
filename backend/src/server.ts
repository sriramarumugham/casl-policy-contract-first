import Fastify from "fastify";
import cors from "@fastify/cors";
import { PrismaClient } from "@prisma/client";
import { PrismaAbility, createPrismaAbility, accessibleBy } from "@casl/prisma";
import { AbilityBuilder } from "@casl/ability";
import { initServer } from "@ts-rest/fastify";
import { generateOpenApi } from "@ts-rest/open-api";
import {
  appContract,
  extractAppPolicy,
  createDefaultUserPolicy,
  interpolatePolicy,
  PolicyRule,
  AppPolicy,
} from "@casl-poc/shared";

const fastify = Fastify({ logger: true });
const prisma = new PrismaClient();

const APP_POLICY = extractAppPolicy(appContract);
console.log("Generated App Policy:", JSON.stringify(APP_POLICY, null, 2));

async function storeAppPolicy() {
  try {
    await prisma.appPolicySchema.create({
      data: {
        schemaJson: JSON.stringify(APP_POLICY),
      },
    });
  } catch (error) {
    console.log("App policy already stored or error:", error);
  }
}

fastify.register(cors, { origin: true });

async function getUserPolicy(userId: number): Promise<PolicyRule[]> {
  const userPolicy = await prisma.userPolicies.findUnique({
    where: { userId },
  });

  if (!userPolicy) {
    return createDefaultUserPolicy(APP_POLICY);
  }

  return JSON.parse(userPolicy.policyJson) as PolicyRule[];
}

function createAbilityFromPolicy(policy: PolicyRule[], userId: number): PrismaAbility {
  const { can, build } = new AbilityBuilder<PrismaAbility>(createPrismaAbility);

  const interpolatedPolicy = interpolatePolicy(policy, { userId });

  for (const rule of interpolatedPolicy) {
    if (rule.conditions) {
      can(rule.action as any, rule.subject as any, rule.conditions);
    } else {
      can(rule.action as any, rule.subject as any);
    }
  }

  return build();
}

declare module 'fastify' {
  interface FastifyRequest {
    userId: number;
    ability: PrismaAbility;
  }
}

fastify.addHook("preHandler", async (request, reply) => {
  const userId = parseInt(request.headers["user-id"] as string) || 1;

  const policy = await getUserPolicy(userId);
  const ability = createAbilityFromPolicy(policy, userId);

  request.userId = userId;
  request.ability = ability;
});

const s = initServer();

const router = s.router(appContract, {
  posts: {
    viewPosts: async ({ request }) => {
      const ability = request.ability;

      try {
        if (!ability.can("read" as any, "Post" as any)) {
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
            posts: posts.map(p => ({
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

      if (!ability.can("create" as any, "Post" as any)) {
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

      if (!ability.can("delete" as any, "Post" as any, post as any)) {
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
      const policy = await getUserPolicy(userId);
      return {
        status: 200,
        body: { policy },
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
      return {
        status: 200,
        body: { schema: APP_POLICY },
      };
    },
  },
});

fastify.register(async function (fastify) {
  s.registerRouter(appContract, router, fastify);
}, { prefix: '/api' });

const openApiDocument = generateOpenApi(
  appContract,
  {
    info: {
      title: "CASL POC API",
      version: "1.0.0",
    },
  },
  {
    setOperationId: true,
  }
);

fastify.get("/openapi.json", () => openApiDocument);

async function start() {
  try {
    await storeAppPolicy();
    await fastify.listen({ port: 3001, host: "0.0.0.0" });
    console.log("Server running on http://localhost:3001");
    console.log("OpenAPI spec available at http://localhost:3001/openapi.json");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();