import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { MemoryManager } from "@/components/memory-manager";

export default async function MemoriesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex h-dvh min-w-0 flex-col bg-background">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl p-4 md:p-6">
          <MemoryManager />
        </div>
      </div>
    </div>
  );
}
