import { useState } from "react";
import { cn } from "@/lib/utils";

interface ExerciseSession {
  exerciseName: string;
  duration: number;
  reps?: number;
  sets?: number;
  weight?: number;
  intensity: number;
  notes?: string;
}

interface ExerciseFormData extends ExerciseSession {
  timestamp?: number;
}

export function ExerciseActivityCard() {
  const [formData, setFormData] = useState<ExerciseFormData>({
    exerciseName: "",
    duration: 0,
    reps: undefined,
    sets: undefined,
    weight: undefined,
    intensity: 5,
    notes: "",
  });

  const [lastSession, setLastSession] = useState<ExerciseSession | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleInputChange = (
    field: keyof ExerciseFormData,
    value: string | number | undefined
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value === "" ? undefined : value,
    }));
  };

  const handleSubmit = () => {
    if (!formData.exerciseName.trim() || !formData.duration) {
      alert("Please enter exercise name and duration.");
      return;
    }

    const sessionData: ExerciseSession = {
      exerciseName: formData.exerciseName.trim(),
      duration: formData.duration,
      reps: formData.reps,
      sets: formData.sets,
      weight: formData.weight,
      intensity: formData.intensity,
      notes: formData.notes?.trim() || undefined,
    };

    // Send to parent vanilla JS
    parent.postMessage(
      {
        type: "exerciseSaved",
        exercise: sessionData,
        timestamp: Date.now(),
      },
      "*"
    );

    // Update last session display
    setLastSession(sessionData);

    // Reset form
    setFormData({
      exerciseName: "",
      duration: 0,
      reps: undefined,
      sets: undefined,
      weight: undefined,
      intensity: 5,
      notes: "",
    });
    setShowForm(false);
  };

  const getIntensityLabel = (intensity: number) => {
    if (intensity <= 3) return "Light";
    if (intensity <= 6) return "Moderate";
    if (intensity <= 8) return "Hard";
    return "Very Hard";
  };

  const getIntensityColor = (intensity: number) => {
    if (intensity <= 3) return "#FFD60A";
    if (intensity <= 6) return "#2CD758";
    if (intensity <= 8) return "#FF6B35";
    return "#FF2D55";
  };

  return (
    <div className="relative h-full rounded-3xl p-6 bg-white dark:bg-black/5 border border-zinc-200 dark:border-zinc-800">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
          💪 Exercise Log
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Track your workouts
        </p>
      </div>

      {/* Last Session Display */}
      {lastSession && !showForm && (
        <div className="mb-6 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
          <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Last Session
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">
                {lastSession.exerciseName}
              </span>
              <span className="font-semibold text-zinc-900 dark:text-white">
                {lastSession.duration} min
              </span>
            </div>
            {(lastSession.reps || lastSession.sets || lastSession.weight) && (
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {[
                  lastSession.sets && `${lastSession.sets} sets`,
                  lastSession.reps && `${lastSession.reps} reps`,
                  lastSession.weight && `${lastSession.weight} lbs`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}
            <div className="flex items-center gap-2 mt-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: getIntensityColor(lastSession.intensity) }}
              />
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                {getIntensityLabel(lastSession.intensity)} intensity
              </span>
            </div>
            {lastSession.notes && (
              <div className="text-xs text-zinc-500 dark:text-zinc-400 italic mt-1">
                {lastSession.notes}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Log Exercise Form */}
      {showForm ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Exercise Name
            </label>
            <input
              type="text"
              value={formData.exerciseName}
              onChange={(e) => handleInputChange("exerciseName", e.target.value)}
              placeholder="e.g. Deadlift"
              className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Duration (min)
              </label>
              <input
                type="number"
                value={formData.duration || ""}
                onChange={(e) => handleInputChange("duration", parseInt(e.target.value) || 0)}
                placeholder="45"
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Intensity (1-10)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.intensity}
                onChange={(e) => handleInputChange("intensity", parseInt(e.target.value) || 5)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Sets
              </label>
              <input
                type="number"
                value={formData.sets || ""}
                onChange={(e) =>
                  handleInputChange("sets", e.target.value ? parseInt(e.target.value) : undefined)
                }
                placeholder="5"
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Reps
              </label>
              <input
                type="number"
                value={formData.reps || ""}
                onChange={(e) =>
                  handleInputChange("reps", e.target.value ? parseInt(e.target.value) : undefined)
                }
                placeholder="8"
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Weight (lbs)
              </label>
              <input
                type="number"
                value={formData.weight || ""}
                onChange={(e) =>
                  handleInputChange("weight", e.target.value ? parseInt(e.target.value) : undefined)
                }
                placeholder="315"
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Notes (optional)
            </label>
            <textarea
              value={formData.notes || ""}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              placeholder="How did it feel?"
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
            >
              Log Exercise
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
        >
          ＋ Log Exercise
        </button>
      )}

      {/* Footer note */}
      <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
          Exercises save to your routine
        </p>
      </div>
    </div>
  );
}
