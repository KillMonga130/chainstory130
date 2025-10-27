// Loading state components for better perceived performance

// Skeleton loading component for better perceived performance
export const SkeletonLoader = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`}></div>
);

// Story skeleton for loading states
export const StorySkeleton = () => (
  <div className="mobile-card bg-white rounded-lg shadow-md p-4 sm:p-6">
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-2">
      <SkeletonLoader className="h-6 w-32" />
      <SkeletonLoader className="h-4 w-48" />
    </div>
    
    <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4">
      <div className="space-y-3">
        <SkeletonLoader className="h-4 w-full" />
        <SkeletonLoader className="h-4 w-5/6" />
        <SkeletonLoader className="h-4 w-4/5" />
        <SkeletonLoader className="h-4 w-full" />
        <SkeletonLoader className="h-4 w-3/4" />
      </div>
    </div>
    
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="text-center p-2 sm:p-3 bg-gray-50 rounded-lg">
          <SkeletonLoader className="h-6 w-8 mx-auto mb-2" />
          <SkeletonLoader className="h-4 w-16 mx-auto" />
        </div>
      ))}
    </div>
  </div>
);

// Leaderboard skeleton
export const LeaderboardSkeleton = () => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <SkeletonLoader className="h-8 w-32" />
      <SkeletonLoader className="h-8 w-20" />
    </div>
    
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Mobile skeleton */}
      <div className="block sm:hidden divide-y divide-gray-200">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center">
                <SkeletonLoader className="h-6 w-8 mr-3" />
                <div>
                  <SkeletonLoader className="h-4 w-48 mb-1" />
                  <SkeletonLoader className="h-3 w-24" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SkeletonLoader className="h-3 w-16" />
                <SkeletonLoader className="h-3 w-20" />
                <SkeletonLoader className="h-3 w-18" />
              </div>
              <SkeletonLoader className="h-6 w-12" />
            </div>
          </div>
        ))}
      </div>
      
      {/* Desktop skeleton */}
      <div className="hidden sm:block">
        <div className="bg-gray-50 px-4 py-3">
          <div className="flex gap-4">
            {['Rank', 'Story', 'Creator', 'Votes', 'Completed', 'Actions'].map((_, i) => (
              <SkeletonLoader key={i} className="h-4 w-20" />
            ))}
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-4 py-4 flex gap-4 items-center">
              <SkeletonLoader className="h-6 w-8" />
              <SkeletonLoader className="h-4 w-48" />
              <SkeletonLoader className="h-4 w-24" />
              <SkeletonLoader className="h-4 w-16" />
              <SkeletonLoader className="h-4 w-20" />
              <SkeletonLoader className="h-6 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// Archive skeleton
export const ArchiveSkeleton = () => (
  <div className="space-y-4 sm:space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center sm:gap-4">
      <SkeletonLoader className="h-8 w-32" />
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
        <SkeletonLoader className="h-10 w-32" />
        <SkeletonLoader className="h-10 w-20" />
      </div>
    </div>
    
    <div className="grid gap-4 sm:gap-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="mobile-card bg-white rounded-lg shadow-md p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start sm:gap-4">
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
                <SkeletonLoader className="h-6 w-20" />
                <SkeletonLoader className="h-4 w-32" />
              </div>
              
              <div className="mb-3">
                <SkeletonLoader className="h-4 w-full mb-2" />
                <SkeletonLoader className="h-4 w-5/6 mb-2" />
                <SkeletonLoader className="h-4 w-4/5" />
              </div>
              
              <div className="flex flex-wrap gap-3 sm:gap-4">
                <SkeletonLoader className="h-4 w-20" />
                <SkeletonLoader className="h-4 w-16" />
                <SkeletonLoader className="h-4 w-24" />
              </div>
            </div>
            
            <SkeletonLoader className="h-10 w-32" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Generic loading spinner with message
export const LoadingSpinner = ({ message }: { message: string }) => (
  <div className="flex justify-center items-center py-12">
    <div className="flex flex-col items-center gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <div className="text-gray-600 text-sm">{message}</div>
    </div>
  </div>
);
