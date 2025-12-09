import { useState, useEffect, useMemo } from "react";
import { initClient } from "@ts-rest/core";
import {
  appContract,
  SUBJECTS,
  ACTIONS,
  AppAbility,
  createTypedAbilityFromJSON,
  Post,
  AppAction,
  AppSubject,
} from "../../shared/src/index";

// 🎯 CASL-Powered Components
import { CreatePostForm } from "./components/CreatePostForm";
import { PostsList } from "./components/PostsList";
import { PolicyEditor } from "./components/PolicyEditor";

// Helper function to create client with current user ID
const createClient = (userId: number) => {
  return initClient(appContract, {
    baseUrl: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
    baseHeaders: {
      "user-id": userId.toString(),
    },
  });
};

export default function App() {
  const [currentUserId, setCurrentUserId] = useState<number>(() => {
    const saved = localStorage.getItem("currentUserId");
    return saved ? parseInt(saved) : 1;
  });
  const [posts, setPosts] = useState<Post[]>([]);
  const [userRules, setUserRules] = useState<any[]>([]);
  const [appSchema, setAppSchema] = useState<any>({});
  const [showPolicyEditor, setShowPolicyEditor] = useState(false);
  const [loading, setLoading] = useState(false);

  // Create typed ability directly from JSON rules - with type safety!
  const ability: AppAbility = useMemo(() => {
    return createTypedAbilityFromJSON(userRules);
  }, [userRules]);

  useEffect(() => {
    loadData();
  }, [currentUserId]);

  const loadData = async () => {
    setLoading(true);
    const client = createClient(currentUserId);
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
        setUserRules(policyRes.body.policy);
      }
      if (schemaRes.status === 200) {
        setAppSchema(schemaRes.body.schema);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const createPost = async (post: { title: string; content: string }) => {
    const client = createClient(currentUserId);
    try {
      const res = await (client.posts as any).createPost({ body: post });
      if (res.status === 201) {
        loadData();
      }
    } catch (error) {
      alert("Cannot create post");
    }
  };

  const deletePost = async (postId: number) => {
    const client = createClient(currentUserId);
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

  const updateUserPolicy = async (newRules: any[]) => {
    const client = createClient(currentUserId);
    try {
      const cleanRules = newRules.map((rule) => ({
        action: rule.action,
        subject: rule.subject,
        conditions: rule.conditions,
      }));

      const res = await (client.policy as any).updateUserPolicy({
        body: { policy: cleanRules },
      });

      if (res.status === 200) {
        loadData();
      }
    } catch (error) {
      alert("Failed to update policy");
    }
  };

  const togglePermission = (subject: string, action: string) => {
    // Use CASL ability directly instead of manually checking rules!
    const hasPermission = ability.can(
      action as AppAction,
      subject as AppSubject
    );

    if (hasPermission) {
      // Remove rule - find and filter out the specific rule
      const newRules = userRules.filter(
        (rule: any) => !(rule.subject === subject && rule.action === action)
      );
      updateUserPolicy(newRules);
    } else {
      // Add rule from available permissions
      const subjectConfig = appSchema[subject];
      if (subjectConfig) {
        const permission = subjectConfig.permissions.find(
          (p: any) => p.action === action && p.subject === subject
        );
        if (permission) {
          const newRules = [...userRules, permission];
          updateUserPolicy(newRules);
        }
      }
    }
  };

  const switchUser = (userId: number) => {
    localStorage.setItem("currentUserId", userId.toString());
    setCurrentUserId(userId);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">🎯 Pure CASL</h1>
            <p className="text-gray-600 mt-2">
              Direct JSON rules • {SUBJECTS.length} subjects • {ACTIONS.length}{" "}
              actions • No utility functions!
            </p>
          </div>
          <div className="flex gap-3 items-center">
            <div className="flex gap-2 bg-white rounded-lg p-1 shadow-sm">
              <button
                onClick={() => switchUser(1)}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  currentUserId === 1
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Alice (User 1)
              </button>
              <button
                onClick={() => switchUser(2)}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  currentUserId === 2
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Bob (User 2)
              </button>
            </div>
            <button
              onClick={() => setShowPolicyEditor(!showPolicyEditor)}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              {showPolicyEditor ? "Hide" : "Edit"} Policy
            </button>
          </div>
        </div>

        <PolicyEditor
          ability={ability}
          appSchema={appSchema}
          onTogglePermission={togglePermission}
          userRules={userRules}
          show={showPolicyEditor}
          onToggle={() => setShowPolicyEditor(false)}
        />

        <CreatePostForm ability={ability} onSubmit={createPost} />

        <PostsList
          posts={posts}
          ability={ability}
          loading={loading}
          onDeletePost={deletePost}
        />
      </div>
    </div>
  );
}
