import { Skeleton } from "@/components/ui/skeleton";

export function LessonCardSkeleton({ featured = false }: { featured?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-xl border border-border ${featured ? "rounded-2xl" : ""}`}>
      <Skeleton className={`w-full ${featured ? "h-52" : "aspect-video"}`} />
      <div className="space-y-3 p-5">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

export function AcademyGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <LessonCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function FeaturedHeroSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <div className="grid md:grid-cols-2">
        <Skeleton className="aspect-video md:aspect-auto md:min-h-[280px]" />
        <div className="space-y-4 p-8">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>
    </div>
  );
}
