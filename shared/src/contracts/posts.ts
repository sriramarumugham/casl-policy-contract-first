import { initContract } from "@ts-rest/core";
import { z } from "zod";

interface PolicyMeta {
  subjects: string[];
  actions: string[];
  conditions?: Record<string, any>;
  description: string;
}

function withPolicy(policy: PolicyMeta) {
  return (contract: any) => ({
    ...contract,
    __policy: policy,
  });
}

const c = initContract();

export const postsContract = c.router({
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

  deletePost: withPolicy({
    subjects: ["Post"],
    actions: ["delete"],
    conditions: {
      authorId: "{{userId}}",
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

  getAppPolicySchema: {
    method: "GET",
    path: "/policy/schema",
    responses: {
      200: z.object({
        schema: z.record(
          z.object({
            actions: z.array(z.string()),
            permissions: z.array(
              z.object({
                action: z.string(),
                subject: z.string(),
                conditions: z.record(z.any()).optional(),
              })
            ),
          })
        ),
      }),
    },
  },
});

export const appContract = c.router({
  posts: postsContract,
  policy: policyContract,
});