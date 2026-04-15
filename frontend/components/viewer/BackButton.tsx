"use client";

import { useRouter } from "next/navigation";

export default function BackButton() {
  const router = useRouter();
  
  return (
    <button 
        onClick={() => router.back()}
        className="block w-full text-center py-2 px-4 rounded-lg bg-gray-100 text-gray-700 font-medium text-xs hover:bg-gray-200 hover:text-black transition-colors"
    >
        &larr; Back
    </button>
  );
}
