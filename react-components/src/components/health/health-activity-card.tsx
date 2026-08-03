import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface MetricData {
  label: string;
  value: string;
  trend: number;
  unit: string;
  color: string;
}

interface HealthMetrics {
  calories: { label: string; value: string; trend: number; unit: string };
  protein: { label: string; value: string; trend: number; unit: string };
  sleep: { label: string; value: string; trend: number; unit: string };
  water: { label: string; value: string; trend: number; unit: string };
  mood: { label: string; value: string; trend: number; unit: string };
  energy: { label: string; value: string; trend: number; unit: string };
  weight: { label: string; value: string; trend: number; unit: string };
}

const METRIC_COLORS = {
  calories: "#FF2D55",
  protein: "#2CD758",
  sleep: "#007AFF",
  water: "#00B4FF",
  mood: "#FFD60A",
  energy: "#FF6B35",
  weight: "#A355FF",
} as const;

const METRIC_ORDER = ["calories", "protein", "sleep", "water", "mood", "energy", "weight"] as const;

export function HealthActivityCard() {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [visibleMetrics, setVisibleMetrics] = useState<string[]>([...METRIC_ORDER]);
  const [isHovering, setIsHovering] = useState<string | null>(null);

  useEffect(() => {
    // Listen for messages from parent vanilla JS
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "updateMetrics") {
        setMetrics(event.data.metrics);
        if (event.data.visible) {
          setVisibleMetrics(event.data.visible);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-black/5 rounded-3xl">
        <p className="text-zinc-500 dark:text-zinc-400">Loading metrics...</p>
      </div>
    );
  }

  return (
    <div className="relative h-full rounded-3xl p-6 bg-white dark:bg-black/5 border border-zinc-200 dark:border-zinc-800">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
          🏥 Health Metrics
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Daily progress
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-4">
        {METRIC_ORDER.map((key) => {
          if (!visibleMetrics.includes(key)) return null;
          const metric = metrics[key as keyof HealthMetrics];

          return (
            <div
              key={key}
              className="flex flex-col items-center"
              onMouseEnter={() => setIsHovering(key)}
              onMouseLeave={() => setIsHovering(null)}
            >
              {/* Circular Progress Ring */}
              <div className="relative w-20 h-20">
                {/* Background ring */}
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    className="text-zinc-200 dark:text-zinc-800"
                  />
                  {/* Progress ring */}
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke={METRIC_COLORS[key as keyof typeof METRIC_COLORS]}
                    strokeWidth="6"
                    strokeDasharray={`${(metric.trend / 100) * 283} 283`}
                    strokeLinecap="round"
                    className={cn("transition-all duration-500", isHovering === key && "brightness-110")}
                  />
                </svg>
                {/* Value center */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm font-bold text-zinc-900 dark:text-white">
                    {metric.value}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {metric.unit}
                  </span>
                </div>
              </div>
              {/* Label and percentage */}
              <span className="mt-3 text-xs font-medium text-zinc-700 dark:text-zinc-300 text-center">
                {metric.label}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {metric.trend}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
          Customize visible metrics in Settings
        </p>
      </div>
    </div>
  );
}
