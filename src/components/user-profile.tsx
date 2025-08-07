"use client";

import { useAuth } from "@clerk/nextjs";
import { useUserSync } from "@/hooks/use-user-sync";

export function UserProfile() {
  const { isSignedIn } = useAuth();
  const { user, isLoading } = useUserSync();
  
  if (!isSignedIn) {
    return (
      <div className="p-6 bg-gray-50 rounded-lg">
        <p className="text-gray-600">Please sign in to view your profile.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 bg-gray-50 rounded-lg">
        <p className="text-gray-600">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg border">
      <h2 className="text-2xl font-bold mb-4">User Profile</h2>
      {user ? (
        <div className="space-y-2">
          <p><strong>ID:</strong> {user.id}</p>
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>First Name:</strong> {user.firstName || 'Not provided'}</p>
          <p><strong>Last Name:</strong> {user.lastName || 'Not provided'}</p>
          <p><strong>Created:</strong> {new Date(user.createdAt).toLocaleDateString()}</p>
        </div>
      ) : (
        <p className="text-gray-600">No user data found.</p>
      )}
    </div>
  );
}
