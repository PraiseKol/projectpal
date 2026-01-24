import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const DataAnalysisSkeleton = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 shadow-sm">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Skeleton className="h-8 w-8 sm:h-9 sm:w-20 rounded-md" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg" />
              <Skeleton className="h-6 w-28 sm:w-40" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-9 w-9 rounded-md" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-5xl">
        {/* Step Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center">
                <Skeleton className="h-10 w-10 rounded-full mb-2" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
          <div className="flex justify-between max-w-2xl mx-auto mt-2 px-5">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-1 flex-1 mx-1" />
            ))}
          </div>
        </div>

        {/* Main Card */}
        <Card className="shadow-lg rounded-2xl">
          <CardHeader>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-80" />
          </CardHeader>
          <CardContent>
            {/* Upload Area */}
            <div className="border-2 border-dashed border-border/50 rounded-2xl p-8 text-center">
              <Skeleton className="h-16 w-16 rounded-full mx-auto mb-4" />
              <Skeleton className="h-5 w-64 mx-auto mb-2" />
              <Skeleton className="h-4 w-48 mx-auto mb-4" />
              <Skeleton className="h-10 w-32 mx-auto" />
            </div>

            {/* Supported Formats */}
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-6 w-20 rounded-full" />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Free User Notice */}
        <Card className="mt-6 p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-5 w-5 mt-0.5" />
            <div className="flex-1">
              <Skeleton className="h-4 w-40 mb-2" />
              <Skeleton className="h-3 w-full max-w-md" />
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
};