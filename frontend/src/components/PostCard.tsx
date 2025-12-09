// 📄 Post Card - Demonstrates CASL power in component form
import { AppAbility, Post } from "@casl-poc/shared";
import { PermissionGate } from "./PermissionGate";

interface PostCardProps {
  post: Post;
  ability: AppAbility;
  onDelete: (id: number) => void;
}

export function PostCard({ post, ability, onDelete }: PostCardProps) {
  return (
    <div className="bg-white shadow-lg rounded-lg p-6 hover:shadow-xl transition-shadow">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-gray-900">{post.title}</h3>
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

        {/* 🔒 CASL Power: Conditional delete button with object-level permissions */}
        <PermissionGate ability={ability} action="delete" subject="Post">
          {/* Additional check for ownership - CASL + business logic */}
          {post.authorId === 1 && (
            <button
              onClick={() => onDelete(post.id)}
              className="ml-4 bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors font-medium"
            >
              Delete
            </button>
          )}
        </PermissionGate>
      </div>
    </div>
  );
}