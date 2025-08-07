import { z } from "zod";
import { eq } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import { users } from "@/server/db/schema";

export const userRouter = createTRPCRouter({
  // Sync user data from Clerk when they sign in
  syncUser: protectedProcedure.mutation(async ({ ctx }) => {
    const clerkUser = await currentUser();
    
    if (!clerkUser) {
      throw new Error("User not found in Clerk");
    }

    // Check if user already exists in our database
    const existingUser = await ctx.db
      .select()
      .from(users)
      .where(eq(users.id, clerkUser.id))
      .limit(1);

    const userData = {
      id: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress || "",
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
    };

    if (existingUser.length === 0) {
      // Create new user
      const [newUser] = await ctx.db.insert(users).values(userData).returning();
      return { user: newUser, created: true };
    } else {
      // Update existing user
      const [updatedUser] = await ctx.db
        .update(users)
        .set({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
        })
        .where(eq(users.id, clerkUser.id))
        .returning();
      return { user: updatedUser, created: false };
    }
  }),

  // Get current user data from database
  getCurrentUser: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db
      .select()
      .from(users)
      .where(eq(users.id, ctx.auth.userId))
      .limit(1);

    return user[0] || null;
  }),

  // Get user by ID (protected, can only be called by authenticated users)
  getUserById: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      return user[0] || null;
    }),

  // Update user profile
  updateProfile: protectedProcedure
    .input(
      z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updatedUser] = await ctx.db
        .update(users)
        .set({
          firstName: input.firstName,
          lastName: input.lastName,
        })
        .where(eq(users.id, ctx.auth.userId))
        .returning();

      return updatedUser;
    }),
});
