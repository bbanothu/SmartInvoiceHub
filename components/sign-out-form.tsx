'use client';

import { signOut } from '@/app/(auth)/auth';

export const SignOutForm = () => {
  return (
    <form
      className="w-full"
      action={async () => {
        await signOut({
          redirectTo: '/',
        });
      }}
    >
      <button
        type="submit"
        className="w-full text-left px-1 py-0.5 text-red-500"
      >
        Sign out
      </button>
    </form>
  );
};
