// 📰 Posts List - Permission-aware post display
import { AppAbility, Post } from "@casl-poc/shared";
import { PermissionGate } from "./PermissionGate";
import { PostCard } from "./PostCard";

interface PostsListProps {
  posts: Post[];
  ability: AppAbility;
  loading: boolean;
  onDeletePost: (id: number) => void;
}

export function PostsList({
  posts,
  ability,
  loading,
  onDeletePost,
}: PostsListProps) {
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p className="mt-2 text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <PermissionGate
      ability={ability}
      action="read"
      subject="Post"
      fallback={
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
            🔒 You don't have permission to view posts.
          </p>
          <p className="mt-2 text-gray-500">
            Edit your policy above to enable post viewing.
          </p>
        </div>
      }
    >
      <div>
        <h2 className="text-2xl font-semibold mb-6 text-gray-900">
          📰 Posts ({posts.length})
        </h2>
        {posts.length === 0 ? (
          <div className="bg-white shadow-lg rounded-lg p-12 text-center">
            <p className="text-gray-500 text-lg">No posts found.</p>
            <PermissionGate ability={ability} action="create" subject="Post">
              <p className="text-gray-400 mt-2">
                Create your first post above!
              </p>
            </PermissionGate>
          </div>
        ) : (
          <div className="grid gap-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                ability={ability}
                onDelete={onDeletePost}
              />
            ))}
          </div>
        )}
      </div>
    </PermissionGate>
  );
}
