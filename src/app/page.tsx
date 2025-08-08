import Link from "next/link";
import { HydrateClient } from "@/trpc/server";
import { currentUser } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";

export default async function Home() {
  // Get the current user (server-side)
  const user = await currentUser();

  // Fallback if user is not signed in
  const firstName = user?.firstName || "there";

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            Hello! <span className="text-[hsl(280,100%,70%)]">{firstName}</span>
          </h1>
          {!user && (
            <p className="text-2xl font-extrabold tracking-tight sm:text-3xl text-center">
              This webapp was created by team <span className="text-[hsl(280,100%,70%)]">catalysts</span>
            </p>
          )}
          <div className="w-full max-w-4xl flex flex-col items-center justify-center gap-8">
            {user ? (
             <div>
               <Link
                className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 hover:bg-white/20 transition"
                href="/resume"
              >
                <h3 className="text-2xl font-bold text-center">Resume Analysis →</h3>
                <div className="text-lg text-center">
                  Upload your resume and get AI-powered insights and recommendations using Gemini 2.5 Flash.
                </div>
                <button className="mt-4 bg-[#6c47ff] text-white rounded-full font-medium text-base h-12 px-6 cursor-pointer self-center">
                  Go to Resume Analysis
                </button>
              </Link>
               <Link
                className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 hover:bg-white/20 transition"
                href="/interview"
              >
                <h3 className="text-2xl font-bold text-center">Take Interview →</h3>
                <div className="text-lg text-center">
                Take interview and see your stats and performance in interviews.  
                </div>
                <button className="mt-4 bg-[#6c47ff] text-white rounded-full font-medium text-base h-12 px-6 cursor-pointer self-center">
                  Go to Interview
                </button>
              </Link>
             </div>
            ) : (
              <div className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 hover:bg-white/20 transition">
                <h3 className="text-2xl font-bold text-center">Sign in to analysis resume →</h3>
                <div className="text-lg text-center">
                  Please sign in to start analyzing your resume with AI-powered insights.
                </div>
                <SignInButton>
                  <button className="mt-4 bg-[#6c47ff] text-white rounded-full font-medium text-base h-12 px-6 cursor-pointer self-center">
                    Sign In
                  </button>
                </SignInButton>
              </div>
            )}
          </div>
        </div>
      </main>
    </HydrateClient>
  );
}