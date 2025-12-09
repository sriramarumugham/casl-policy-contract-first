import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { withPolicy } from "../utils/contract-helpers";

const c = initContract();

const postsContract = c.router({
  viewPosts: withPolicy({
    subjects: "Post",
    actions: "read",
    description: "Get all posts",
  })({
    method: "GET",
    path: "/posts",
    responses: {
      200: z
        .object({
          posts: z.array(
            z
              .object({
                id: z.number().describe("Unique post identifier"),
                title: z.string().describe("Post title"),
                content: z.string().describe("Post content"),
                authorId: z.number().describe("ID of the post author"),
              })
              .describe("Post object")
          ),
        })
        .describe("List of posts response"),
    },
  }),

  createPost: withPolicy({
    subjects: "Post",
    actions: "create",
    description: "Create a new post",
  })({
    method: "POST",
    path: "/posts",
    body: z
      .object({
        title: z.string().describe("Title of the post"),
        content: z.string().describe("Content of the post"),
      })
      .describe("Post creation data"),
    responses: {
      201: z
        .object({
          post: z
            .object({
              id: z.number().describe("Unique post identifier"),
              title: z.string().describe("Post title"),
              content: z.string().describe("Post content"),
              authorId: z.number().describe("ID of the post author"),
            })
            .describe("Created post object"),
        })
        .describe("Post creation success response"),
      403: z
        .object({
          error: z.string().describe("Authorization error message"),
        })
        .describe("Forbidden - insufficient permissions"),
    },
  }),

  deletePost: withPolicy({
    subjects: "Post",
    actions: "delete",
    conditions: { authorId: "{{userId}}" },
    description: "Delete a post (only own posts)",
  })({
    method: "DELETE",
    path: "/posts/:id",
    pathParams: z.object({
      id: z.string().transform(Number).describe("Post ID to delete"),
    }),
    responses: {
      200: z
        .object({
          success: z.boolean().describe("Deletion success status"),
        })
        .describe("Deletion success response"),
      403: z
        .object({
          error: z.string().describe("Authorization error message"),
        })
        .describe("Forbidden - insufficient permissions or not post owner"),
      404: z
        .object({
          error: z.string().describe("Error message"),
        })
        .describe("Post not found"),
    },
  }),
});

// 🎯 Policy metadata now integrated via withPolicy() wrapper!

export { postsContract };

export const policyContract = c.router({
  getUserPolicy: {
    method: "GET",
    path: "/policy/user",
    summary: "Get user's CASL policy",
    description:
      "Retrieves the current user's CASL ability rules with interpolated conditions.",
    responses: {
      200: z
        .object({
          policy: z
            .array(
              z
                .object({
                  action: z
                    .string()
                    .describe("CASL action (create, read, update, delete)"),
                  subject: z
                    .string()
                    .describe("CASL subject (Post, User, Comment)"),
                  conditions: z
                    .record(z.any())
                    .optional()
                    .describe("Optional conditions for the rule"),
                })
                .describe("CASL ability rule")
            )
            .describe("Array of user's ability rules"),
        })
        .describe("User policy response"),
    },
  },

  updateUserPolicy: {
    method: "PUT",
    path: "/policy/user",
    summary: "Update user's CASL policy",
    description:
      "Updates the user's CASL ability rules. Rules are stored and will be interpolated on subsequent requests.",
    body: z
      .object({
        policy: z
          .array(
            z
              .object({
                action: z
                  .string()
                  .describe("CASL action (create, read, update, delete)"),
                subject: z
                  .string()
                  .describe("CASL subject (Post, User, Comment)"),
                conditions: z
                  .record(z.any())
                  .optional()
                  .describe(
                    "Optional conditions for the rule (use {{userId}} for templates)"
                  ),
              })
              .describe("CASL ability rule")
          )
          .describe("Array of ability rules to set for the user"),
      })
      .describe("Policy update request"),
    responses: {
      200: z
        .object({
          success: z.boolean().describe("Update success status"),
        })
        .describe("Policy update success response"),
    },
  },

  getAppPolicySchema: {
    method: "GET",
    path: "/policy/schema",
    summary: "Get application policy schema",
    description:
      "Retrieves the complete schema of available permissions in the application, extracted from contracts.",
    responses: {
      200: z
        .object({
          schema: z
            .record(
              z
                .object({
                  actions: z.array(
                    z.string().describe("Available actions for this subject")
                  ),
                  permissions: z
                    .array(
                      z
                        .object({
                          action: z.string().describe("CASL action"),
                          subject: z.string().describe("CASL subject"),
                          conditions: z
                            .record(z.any())
                            .optional()
                            .describe(
                              "Required conditions for this permission"
                            ),
                        })
                        .describe("Available permission rule")
                    )
                    .describe("All available permissions for this subject"),
                })
                .describe("Subject permission schema")
            )
            .describe(
              "Complete application permission schema organized by subject"
            ),
        })
        .describe("Application policy schema response"),
    },
  },
});

export const appContract = c.router({
  posts: postsContract,
  policy: policyContract,
});
