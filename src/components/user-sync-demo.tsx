"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { api } from "@/trpc/react";

export function UserSyncDemo() {
  const { isSignedIn } = useAuth();
  const { user: clerkUser } = useUser();
  const { data: dbUser, isLoading: isLoadingDbUser, refetch } = api.user.getCurrentUser.useQuery(
    undefined,
    { enabled: isSignedIn }
  );

  const syncUserMutation = api.user.syncUser.useMutation({
    onSuccess: () => {
      refetch(); // Refresh the database user data
    },
  });

  if (!isSignedIn) {
    return (
      <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="text-lg font-semibold text-yellow-800 mb-2">🔐 Authentication Demo</h3>
        <p className="text-yellow-700">Sign in to see the Clerk + tRPC + Drizzle integration in action!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-6 bg-blue-500 border border-blue-200 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-800 mb-4">👤 Clerk User Data</h3>
        <div className="space-y-2 text-sm">
          <p><strong>ID:</strong> {clerkUser?.id}</p>
          <p><strong>Email:</strong> {clerkUser?.emailAddresses[0]?.emailAddress}</p>
          <p><strong>First Name:</strong> {clerkUser?.firstName || 'Not set'}</p>
          <p><strong>Last Name:</strong> {clerkUser?.lastName || 'Not set'}</p>
        </div>
      </div>

      <div className="p-6 bg-green-500 border border-green-200 rounded-lg">
        <h3 className="text-lg font-semibold text-green-800 mb-4">🗄️ Database User Data</h3>
        {isLoadingDbUser ? (
          <p className="text-green-600">Loading database user...</p>
        ) : dbUser ? (
          <div className="space-y-2 text-sm">
            <p><strong>ID:</strong> {dbUser.id}</p>
            <p><strong>Email:</strong> {dbUser.email}</p>
            <p><strong>First Name:</strong> {dbUser.firstName || 'Not set'}</p>
            <p><strong>Last Name:</strong> {dbUser.lastName || 'Not set'}</p>
            <p><strong>Created At:</strong> {new Date(dbUser.createdAt).toLocaleString()}</p>
          </div>
        ) : (
          <p className="text-green-600">User not found in database. Click sync to create.</p>
        )}
      </div>

      <div className="p-6 bg-purple-50 border border-purple-200 rounded-lg">
        <h3 className="text-lg font-semibold text-purple-800 mb-4">🔄 Manual Sync</h3>
        <p className="text-purple-600 mb-4">
          User data is automatically synced when you sign in. You can also manually sync:
        </p>
        <button
          onClick={() => syncUserMutation.mutate()}
          disabled={syncUserMutation.isPending}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {syncUserMutation.isPending ? 'Syncing...' : 'Sync User Data'}
        </button>
        {syncUserMutation.isSuccess && (
          <p className="mt-2 text-green-600 text-sm">✅ User synced successfully!</p>
        )}
        {syncUserMutation.isError && (
          <p className="mt-2 text-red-600 text-sm">❌ Sync failed: {syncUserMutation.error.message}</p>
        )}
      </div>
    </div>
  );
}
