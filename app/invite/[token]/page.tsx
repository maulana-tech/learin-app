import { redirect } from "next/navigation";

import { apiResult, me } from "@/app/lib";
import { Chip } from "@/components/dort";
import { Accept } from "./Accept";

export const dynamic = "force-dynamic";

export default async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Outside the app shell so someone without an account lands here, signs up, and comes back.
  if (!(await me())) redirect(`/login?next=/invite/${token}`);
  const r = await apiResult<{ workspace_id: string; name: string; purpose: string | null; members: number; expires_at: string }>(`invites/${token}`);
  return (
    <main className="flex min-h-svh w-full flex-1 items-center justify-center px-4 py-10">
      <div className="bg-inner-grad w-full max-w-md rounded-xl border p-6 shadow-soft">
        {r.data ? (
          <>
            <p className="text-muted-foreground text-[12.5px]">You are invited to</p>
            <h1 className="mt-1 text-2xl font-medium tracking-tight">{r.data.name}</h1>
            {r.data.purpose && <p className="text-muted-foreground mt-2 text-[13.5px] leading-relaxed">{r.data.purpose}</p>}
            <div className="mt-3"><Chip tone="info">{r.data.members} member(s)</Chip></div>
            <div className="mt-6"><Accept token={token} workspaceId={r.data.workspace_id} /></div>
          </>
        ) : (
          <>
            <h1 className="text-xl font-medium">This invite cannot be used</h1>
            <p className="text-muted-foreground mt-2 text-[13.5px]">{r.error}</p>
          </>
        )}
      </div>
    </main>
  );
}
