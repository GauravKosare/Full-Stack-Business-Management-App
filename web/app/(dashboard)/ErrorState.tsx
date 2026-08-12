"use client";

import { useRouter } from "next/navigation";

export function ErrorState({ message }: { message: string }) {
  const router = useRouter();

  return (
    <div className="rounded-card border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-sm font-medium text-danger">{message}</p>
      <button
        onClick={() => router.back()}
        className="mt-4 rounded-card border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Go back
      </button>
    </div>
  );
}
