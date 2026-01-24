import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const SettingsSkeleton = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 shadow-sm">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Skeleton className="h-8 w-8 sm:h-9 sm:w-20 rounded-md" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg" />
              <Skeleton className="h-6 w-20 sm:w-24" />
            </div>
          </div>
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-3xl">
        {/* Quick Links */}
        <Card className="mb-6 shadow-lg rounded-2xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-6 w-28" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full rounded-xl" />
          </CardContent>
        </Card>

        {/* Account Information */}
        <Card className="mb-6 shadow-lg rounded-2xl">
          <CardHeader>
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-56 mt-1" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 p-4 bg-accent rounded-xl">
              <Skeleton className="h-5 w-5" />
              <div>
                <Skeleton className="h-3 w-24 mb-1" />
                <Skeleton className="h-5 w-48" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plan & Credits */}
        <Card className="mb-6 shadow-lg rounded-2xl">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64 mt-1" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-accent rounded-xl">
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-5" />
                <div>
                  <Skeleton className="h-3 w-24 mb-1" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-10 w-36 rounded-xl" />
            </div>

            <div className="grid gap-3 sm:gap-4 grid-cols-1 xs:grid-cols-2">
              <div className="p-4 bg-accent rounded-xl">
                <Skeleton className="h-4 w-28 mb-2" />
                <Skeleton className="h-9 w-16" />
                <Skeleton className="h-3 w-36 mt-1" />
              </div>
              <div className="p-4 bg-accent rounded-xl">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-3 w-28 mt-1" />
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-accent rounded-xl">
              <Skeleton className="h-5 w-5" />
              <div>
                <Skeleton className="h-3 w-28 mb-1" />
                <Skeleton className="h-5 w-32" />
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};