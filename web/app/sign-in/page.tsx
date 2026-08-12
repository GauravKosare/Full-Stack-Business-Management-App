import Link from "next/link";
import { API_URL } from "@/lib/api";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-card border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="mb-2 text-xl font-semibold text-gray-900">Business Management App</h1>
        <p className="mb-6 text-sm text-gray-500">Sign in to continue</p>
        <a
          href={`${API_URL}/api/v1/auth/google?platform=web`}
          className="inline-flex w-full items-center justify-center rounded-card bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Sign in with Google
        </a>

        <div className="mt-4 flex items-center gap-2">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-400">or</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <div className="mt-4 flex flex-col gap-2 text-sm">
          <Link
            href="/login"
            className="rounded-card border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
          >
            Log in with email
          </Link>
          <Link
            href="/sign-up"
            className="rounded-card border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
          >
            Sign up with email
          </Link>
        </div>
      </div>
    </div>
  );
}
