# Create T3 App with Clerk Authentication

This is a [T3 Stack](https://create.t3.gg/) project bootstrapped with `create-t3-app` and integrated with [Clerk](https://clerk.com) authentication.

## Features

- ✅ **Clerk Authentication** - Complete user authentication with sign-up, sign-in, and profile management
- ✅ **Automatic User Sync** - Users are automatically created/updated in PostgreSQL database when they sign in
- ✅ **tRPC Integration** - Protected routes with Clerk authentication middleware
- ✅ **Database Integration** - Users table with Drizzle ORM and PostgreSQL (Neon)
- ✅ **Real-time Sync** - User data syncs between Clerk and your database on every sign-in

## Setup Instructions

### 1. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://username:password@ep-xxx-pooler.us-east-1.postgres.neon.tech/catalyst?sslmode=require"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
```

### 2. Clerk Setup

1. Create a [Clerk](https://clerk.com) account
2. Create a new application
3. Copy the API keys to your `.env` file
4. Configure your sign-in/sign-up options in Clerk dashboard

### 3. Database Setup

```bash
# Push the schema to your database
pnpm db:push

# Or run migrations
pnpm db:generate
pnpm db:migrate
```

## How It Works

### User Authentication Flow

1. **User signs in/up** through Clerk components (`<SignInButton>`, `<SignUpButton>`)
2. **UserSyncProvider** automatically detects the sign-in event
3. **tRPC mutation** (`user.syncUser`) is called to sync user data
4. **Database operation** creates or updates the user in PostgreSQL
5. **User data** is now available throughout your app via tRPC queries

### Key Files

- `src/server/api/routers/user.ts` - User tRPC router with sync logic
- `src/components/user-sync-provider.tsx` - Automatic user syncing component
- `src/hooks/use-user-sync.ts` - Hook for accessing synced user data
- `src/server/db/schema.ts` - Database schema with users table

### Usage Examples

```tsx
// Get current user data
function MyComponent() {
  const { user, isLoading } = useUserSync();
  
  if (isLoading) return <div>Loading...</div>;
  
  return <div>Hello, {user?.firstName}!</div>;
}

// Use tRPC directly
function UserProfile() {
  const { data: user } = api.user.getCurrentUser.useQuery();
  
  return <div>Email: {user?.email}</div>;
}
```

## What's next? How do I make an app with this?

We try to keep this project as simple as possible, so you can start with just the scaffolding we set up for you, and add additional things later when they become necessary.

If you are not familiar with the different technologies used in this project, please refer to the respective docs. If you still are in the wind, please join our [Discord](https://t3.gg/discord) and ask for help.

- [Next.js](https://nextjs.org)
- [NextAuth.js](https://next-auth.js.org)
- [Prisma](https://prisma.io)
- [Drizzle](https://orm.drizzle.team)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)

## Learn More

To learn more about the [T3 Stack](https://create.t3.gg/), take a look at the following resources:

- [Documentation](https://create.t3.gg/)
- [Learn the T3 Stack](https://create.t3.gg/en/faq#what-learning-resources-are-currently-available) — Check out these awesome tutorials

You can check out the [create-t3-app GitHub repository](https://github.com/t3-oss/create-t3-app) — your feedback and contributions are welcome!

## How do I deploy this?

Follow our deployment guides for [Vercel](https://create.t3.gg/en/deployment/vercel), [Netlify](https://create.t3.gg/en/deployment/netlify) and [Docker](https://create.t3.gg/en/deployment/docker) for more information.
