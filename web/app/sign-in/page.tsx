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
      </div>
    </div>
  );
}
