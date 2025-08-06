import { useState, useEffect } from "react";
import { createMongoAbility, MongoAbility } from "@casl/ability";
import { initClient } from "@ts-rest/core";
import {
  appContract,
  PolicyRule,
  AppPolicy,
} from "@casl-poc/shared";

interface Post {
  id: number;
  title: string;
  content: string;
  authorId: number;
}

const client = initClient(appContract, {
  baseUrl: "http://localhost:3001/api",
  baseHeaders: {
    "user-id": "1",
  },
});

function createAbility(policy: PolicyRule[], userId: number = 1): MongoAbility {
  const rules = policy.map(rule => {
    const conditions = interpolateConditions(rule.conditions, { userId });
    return {
      action: rule.action,
      subject: rule.subject,
      conditions: conditions || undefined
    };
  });

  return createMongoAbility(rules);
}

function canDeletePost(ability: MongoAbility, post: Post, userId: number = 1): boolean {
  // Check if user has delete permission for Post
  if (!ability.can("delete", "Post")) {
    return false;
  }
  
  // Check ownership condition manually since MongoAbility might not handle it correctly
  const deleteRule = ability.rules.find(rule => 
    rule.action === "delete" && rule.subject === "Post"
  );
  
  if (deleteRule?.conditions?.authorId !== undefined) {
    return post.authorId === userId;
  }
  
  return true;
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
  const [loading, setLoading] = useState(false);

  const ability = createAbility(userPolicy);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [postsRes, policyRes, schemaRes] = await Promise.all([
        (client.posts as any).viewPosts(),
        (client.policy as any).getUserPolicy(),
        (client.policy as any).getAppPolicySchema(),
      ]);

      if (postsRes.status === 200) {
        setPosts(postsRes.body.posts);
      }
      if (policyRes.status === 200) {
        setUserPolicy(policyRes.body.policy);
      }
      if (schemaRes.status === 200) {
        setAppPolicy(schemaRes.body.schema);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const createPost = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await (client.posts as any).createPost({
        body: newPost,
      });
      
      if (res.status === 201) {
        setNewPost({ title: "", content: "" });
        loadData();
      }
    } catch (error) {
      alert("Cannot create post");
    }
  };

  const deletePost = async (postId: number) => {
    try {
      const res = await (client.posts as any).deletePost({
        params: { id: postId.toString() },
      });
      
      if (res.status === 200) {
        loadData();
      }
    } catch (error) {
      alert("Cannot delete post");
    }
  };

  const updateUserPolicy = async (newPolicy: PolicyRule[]) => {
    try {
      const res = await (client.policy as any).updateUserPolicy({
        body: { policy: newPolicy },
      });
      
      if (res.status === 200) {
        setUserPolicy(newPolicy);
        loadData();
      }
    } catch (error) {
      alert("Failed to update policy");
    }
  };

  const togglePermission = (subject: string, action: string) => {
    const hasPermission = userPolicy.some(
      (rule) => rule.subject === subject && rule.action === action
    );

    if (hasPermission) {
      const newPolicy = userPolicy.filter(
        (rule) => !(rule.subject === subject && rule.action === action)
      );
      updateUserPolicy(newPolicy);
    } else {
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
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-6xl mx-auto p-6">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">TS-REST + CASL Demo</h1>
              <p className="text-gray-600 mt-2">Policy-based authorization with TypeScript</p>
            </div>
            <button
              onClick={() => setShowPolicyEditor(!showPolicyEditor)}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              {showPolicyEditor ? "Hide" : "Edit"} Policy
            </button>
          </div>

          {showPolicyEditor && (
            <div className="bg-white shadow-lg rounded-lg p-6 mb-8">
              <h2 className="text-2xl font-semibold mb-6 text-gray-900">Edit Your Permissions</h2>

              {Object.entries(appPolicy).map(([subject, config]) => (
                <div key={subject} className="mb-6">
                  <h3 className="font-medium text-lg mb-3 text-gray-700">{subject} Permissions:</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {config.actions.map((action) => {
                      const hasPermission = userPolicy.some(
                        (rule) => rule.subject === subject && rule.action === action
                      );
                      const permission = config.permissions.find(
                        (p) => p.action === action
                      );

                      return (
                        <label
                          key={action}
                          className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={hasPermission}
                            onChange={() => togglePermission(subject, action)}
                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                          />
                          <div>
                            <span className="capitalize font-medium">{action}</span>
                            {permission?.conditions && (
                              <span className="text-xs text-gray-500 block">
                                (with conditions)
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-sm mb-2">Current Policy JSON:</h4>
                <pre className="bg-white p-3 rounded border text-xs overflow-x-auto">
                  {JSON.stringify(userPolicy, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {ability.can("create", "Post") && (
            <div className="bg-white shadow-lg rounded-lg p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">Create New Post</h2>
              <form onSubmit={createPost} className="space-y-4">
                <input
                  type="text"
                  placeholder="Post title"
                  value={newPost.title}
                  onChange={(e) =>
                    setNewPost({ ...newPost, title: e.target.value })
                  }
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
                <textarea
                  placeholder="Post content"
                  value={newPost.content}
                  onChange={(e) =>
                    setNewPost({ ...newPost, content: e.target.value })
                  }
                  className="w-full px-4 py-2 border rounded-lg h-24 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
                <button
                  type="submit"
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  Create Post
                </button>
              </form>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="mt-2 text-gray-600">Loading...</p>
            </div>
          ) : ability.can("read", "Post") ? (
            <div>
              <h2 className="text-2xl font-semibold mb-6 text-gray-900">
                Posts ({posts.length})
              </h2>
              {posts.length === 0 ? (
                <div className="bg-white shadow-lg rounded-lg p-12 text-center">
                  <p className="text-gray-500 text-lg">No posts found.</p>
                  {ability.can("create", "Post") && (
                    <p className="text-gray-400 mt-2">Create your first post above!</p>
                  )}
                </div>
              ) : (
                <div className="grid gap-4">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      className="bg-white shadow-lg rounded-lg p-6 hover:shadow-xl transition-shadow"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-gray-900">
                            {post.title}
                          </h3>
                          <p className="text-gray-700 mt-2">{post.content}</p>
                          <div className="mt-4 flex items-center text-sm text-gray-500">
                            <span className="bg-gray-100 px-2 py-1 rounded">
                              Author ID: {post.authorId}
                            </span>
                            <span className="ml-2 bg-gray-100 px-2 py-1 rounded">
                              Post ID: {post.id}
                            </span>
                          </div>
                        </div>

                        {canDeletePost(ability, post) && (
                          <button
                            onClick={() => deletePost(post.id)}
                            className="ml-4 bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors font-medium"
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
            <div className="bg-white shadow-lg rounded-lg p-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <p className="mt-4 text-lg text-gray-600">
                You don't have permission to view posts.
              </p>
              <p className="mt-2 text-gray-500">
                Edit your policy above to enable post viewing.
              </p>
            </div>
          )}
        </div>
      </div>
  );
}