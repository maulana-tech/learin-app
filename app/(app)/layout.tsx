import { redirect } from "next/navigation";

import { api, me } from "@/app/lib";
import { AppSidebar } from "@/components/app-sidebar";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ThemeToggle } from "@/components/theme";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, health] = await Promise.all([
    me(),
    api<{ env: string; server_ai: boolean }>("health"),
  ]);
  // The service answers and does not know you: sign in. It does not answer at
  // all: stay, and let the pages say the service is down.
  if (health && !user) redirect("/login");

  return (
    <SidebarProvider>
      <AppSidebar user={user ?? undefined} connection={health ?? undefined} />
      <SidebarInset>
        <header className="bg-background/80 sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur md:px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="min-w-0 flex-1">
            <Breadcrumbs />
          </div>
          <div className="ml-auto shrink-0">
            <ThemeToggle />
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
