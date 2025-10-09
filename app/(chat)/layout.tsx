import { cookies, headers } from "next/headers";
import Script from "next/script";
import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatProvider } from "@/components/chat-context";
import { DataStreamProvider } from "@/components/data-stream-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";

export const experimental_ppr = true;

async function LayoutContent({ children }: { children: React.ReactNode }) {
  const [session, cookieStore] = await Promise.all([
    auth.api.getSession({
      headers: await headers(),
    }),
    cookies(),
  ]);
  const isCollapsed = cookieStore.get("sidebar_state")?.value !== "true";

  return (
    <SidebarProvider defaultOpen={!isCollapsed}>
      <AppSidebar user={session?.user} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="beforeInteractive"
      />
      <DataStreamProvider>
        <ChatProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <LayoutContent>{children}</LayoutContent>
          </Suspense>
        </ChatProvider>
      </DataStreamProvider>
    </>
  );
}
