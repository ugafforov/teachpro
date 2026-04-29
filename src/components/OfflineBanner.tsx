import React from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { WifiOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export const OfflineBanner: React.FC = () => {
  const isOnline = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 pointer-events-none">
      <Alert 
        className={cn(
          "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700",
          "shadow-lg animate-in slide-in-from-bottom-5 fade-in duration-300",
          "flex items-center gap-3 pointer-events-auto"
        )}
      >
        <WifiOff className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        <AlertDescription className="text-amber-800 dark:text-amber-300 font-medium text-sm">
          Siz hozir offlinesiz. O'zgarishlar saqlanmoqda va internet kelishi bilan yuklanadi.
        </AlertDescription>
      </Alert>
    </div>
  );
};
