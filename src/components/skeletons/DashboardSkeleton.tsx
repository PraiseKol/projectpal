import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const DashboardSkeleton = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-md" />
            <div className="hidden md:flex items-center gap-2">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
            </div>
            <Skeleton className="h-9 w-9 rounded-md md:hidden" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Credit Info Card */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-10 w-32 rounded-md" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:gap-4 grid-cols-1 xs:grid-cols-2">
              <div className="p-4 bg-accent/50 rounded-2xl border border-border/50">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-3 w-40 mt-2" />
              </div>
              <div className="p-4 bg-accent/50 rounded-2xl border border-border/50">
                <Skeleton className="h-4 w-28 mb-2" />
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-3 w-32 mt-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <div className="mb-8 space-y-4">
          <Skeleton className="h-8 w-40" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border/50">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-24 mt-1" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature Cards */}
        <Skeleton className="h-8 w-32 mb-4" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4">
              <div className="flex items-start gap-4">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};