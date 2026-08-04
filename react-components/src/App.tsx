import { useMemo } from 'react';
import { HealthApp } from './components/health/health-app';
import { ExerciseApp } from './components/exercise/exercise-app';

export default function App() {
  const app = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const appType = params.get('app');
    return appType === 'exercise' ? 'exercise' : 'health';
  }, [window.location.search]);

  return app === 'health' ? <HealthApp /> : <ExerciseApp />;
}
