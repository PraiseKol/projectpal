import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export const ParaphraserSkeleton = () => {
  return (
    <div className="min-h-screen bg-background p-3 sm:p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Skeleton className="h-10 w-40 self-start" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>

        {/* Notice Card */}
        <Card className="mb-4 p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-5 w-5 mt-0.5" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-64" />
              <Skeleton className="h-9 w-40 mt-2" />
            </div>
          </div>
        </Card>

        {/* Main Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-1 w-full mb-3" />
            <Skeleton className="min-h-[250px] sm:min-h-[400px] w-full mb-3 sm:mb-4" />
            <Skeleton className="h-10 sm:h-11 w-full" />
          </Card>

          <Card className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <Skeleton className="h-5 w-40" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-8 sm:h-9 sm:w-9" />
                <Skeleton className="h-8 w-8 sm:h-9 sm:w-9" />
              </div>
            </div>
            <Skeleton className="min-h-[250px] sm:min-h-[400px] w-full" />
          </Card>
        </div>
      </div>
    </div>
  );
};