import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export const DocumentsSkeleton = () => {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-10 w-40" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-7 w-36" />
          </div>
        </div>

        {/* Upload Card */}
        <Card className="p-6 shadow-md rounded-2xl">
          <div className="space-y-6">
            <div>
              <Skeleton className="h-6 w-40 mb-4" />
              <Skeleton className="h-4 w-80 mb-4" />
              <div className="flex gap-4">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-28" />
              </div>
            </div>

            {/* Generate Section */}
            <div>
              <Skeleton className="h-6 w-48 mb-4" />
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-10 w-52" />
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};