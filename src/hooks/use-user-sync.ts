"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { api } from "@/trpc/react";

/**
 * Hook to automatically sync user data with the database when they sign in
 */
export function useUserSync() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  
  const syncUserMutation = api.user.syncUser.useMutation();
  const userQuery = api.user.getCurrentUser.useQuery(
    undefined,
    {
      enabled: isSignedIn,
      retry: false,
    }
  );

  useEffect(() => {
    if (isSignedIn && user && !userQuery.data && !syncUserMutation.isPending) {
      // User is signed in but not in our database, sync them
      syncUserMutation.mutate();
    }
  }, [isSignedIn, user, userQuery.data, syncUserMutation]);

  return {
    isLoading: syncUserMutation.isPending || userQuery.isLoading,
    isError: syncUserMutation.isError || userQuery.isError,
    user: userQuery.data,
    refetch: userQuery.refetch,
  };
}
