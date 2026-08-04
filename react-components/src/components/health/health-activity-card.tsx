import { useEffect, useState } from "react";
import { ActivityCard, type Metric } from "@/components/ui/activity-card";

interface RawMetric { label: string; value: string | number; trend: number; unit: string; }

interface HealthMetrics {
  calories: RawMetric;
  protein: RawMetric;
  sleep: RawMetric;
  water: RawMetric;
  mood: RawMetric;
  energy: RawMetric;
  weight: RawMetric;
}

const METRIC_ORDER = ["calories", "protein", "sleep", "water", "mood", "energy", "weight"] as const;

export function HealthActivityCard() {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [visibleMetrics, setVisibleMetrics] = useState<string[]>([...METRIC_ORDER]);

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

  const cardMetrics: Metric[] = METRIC_ORDER
    .filter((key) => visibleMetrics.includes(key))
    .map((key) => {
      const m = metrics[key];
      return {
        label: m.label,
        value: String(m.value),
        trend: m.trend,
        unit: m.unit,
      };
    });

  return (
    <div className="h-full flex flex-col gap-3">
      <ActivityCard category="Health" title="🏥 Health Metrics" metrics={cardMetrics} className="flex-1" />
      <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
        Customize visible metrics in Settings
      </p>
    </div>
  );
}
