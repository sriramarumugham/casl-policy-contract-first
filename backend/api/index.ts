import Fastify from "fastify";
import cors from "@fastify/cors";
import { PrismaClient } from "@prisma/client";
import { initServer } from "@ts-rest/fastify";
import awsLambdaFastify from "@fastify/aws-lambda";
import {
  appContract,
  APP_ABILITY_RULES,
  createAppAbility,
  AppAbility,
} from "@casl-poc/shared";

const prisma = new PrismaClient();

// Simple API: Get user's ability rules
async function getUserAbilityRules(userId: number) {
  const userPolicy = await prisma.userPolicies.findUnique({
    where: { userId },
  });

  if (!userPolicy) {
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

// Create Fastify instance
const fastify = Fastify({
  logger: false, // Disable logger for serverless
});

fastify.register(cors, { origin: true });

fastify.addHook("preHandler", async (request) => {
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
          include: { author: true },
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
        status: 201 as any,
        body: {
          id: post.id,
          title: post.title,
          content: post.content,
          authorId: post.authorId,
        } as any,
      };
    },

    deletePost: async ({ params, request }: any) => {
      const ability = request.ability;
      const postId = parseInt(params.id);
      const post = await prisma.post.findUnique({ where: { id: postId } });
      if (!post) {
        return {
          status: 404 as any,
          body: { error: "Post not found" } as any,
        };
      }
      if (!ability.can("delete", { ...post, __typename: "Post" } as any)) {
        return {
          status: 403 as any,
          body: { error: "Cannot delete this post" } as any,
        };
      }
      await prisma.post.delete({ where: { id: postId } });
      return { status: 200 as any, body: { success: true } as any };
    },
  },

  policy: {
    getUserPolicy: async ({ request }) => {
      const userId = request.userId;
      const userPolicy = await prisma.userPolicies.findUnique({
        where: { userId },
      });
      const policy = userPolicy
        ? JSON.parse(userPolicy.policyJson)
        : APP_ABILITY_RULES;
      return { status: 200, body: { policy } };
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
        },
      });
      return { status: 200, body: { success: true } };
    },

    getAppPolicySchema: async () => {
      const schema = await prisma.appPolicySchema.findFirst({
        orderBy: { createdAt: "desc" },
      });
      return {
        status: 200,
        body: { schema: schema ? JSON.parse(schema.schemaJson) : {} },
      };
    },
  },
});

s.registerRouter(appContract as any, router, fastify, {
  logInitialization: false,
  responseValidation: true,
  requestValidationErrorHandler(err, req, reply) {
    console.error("Validation error:", err);
    reply.status(400).send({ error: "Invalid request", details: err.message });
  },
});

// Export Vercel handler
export default awsLambdaFastify(fastify);
