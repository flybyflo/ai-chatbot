import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function MCPServerSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Skeleton className="size-2 rounded-full" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="size-4" />
        </div>
      </CardHeader>
    </Card>
  );
}