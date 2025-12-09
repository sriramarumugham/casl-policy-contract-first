// ✏️ Create Post Form - Wrapped in CASL permission gate
import { useState } from "react";
import { AppAbility } from "@casl-poc/shared";
import { PermissionGate } from "./PermissionGate";

interface CreatePostFormProps {
  ability: AppAbility;
  onSubmit: (post: { title: string; content: string }) => void;
}

export function CreatePostForm({ ability, onSubmit }: CreatePostFormProps) {
  const [newPost, setNewPost] = useState({ title: "", content: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(newPost);
    setNewPost({ title: "", content: "" });
  };

  return (
    <PermissionGate 
      ability={ability} 
      action="create" 
      subject="Post"
      fallback={
        <div className="bg-gray-100 shadow-lg rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold mb-4 text-gray-600">🔒 Create Post</h2>
          <p className="text-gray-500">You don't have permission to create posts.</p>
        </div>
      }
    >
      <div className="bg-white shadow-lg rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">✏️ Create New Post</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Post title"
            value={newPost.title}
            onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          />
          <textarea
            placeholder="Post content"
            value={newPost.content}
            onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
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
    </PermissionGate>
  );
}