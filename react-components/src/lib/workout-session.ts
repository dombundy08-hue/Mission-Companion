// A workout in progress should hold the screen — BottomNav/TopBar check this
// flag before navigating away and refuse if a session is active, so an
// accidental tab tap can't silently abandon a running workout. The only way
// out is Workout.tsx's own End Workout / Cancel buttons, which clear it.
let active = false;

export function isWorkoutActive(): boolean {
  return active;
}

export function setWorkoutActive(v: boolean) {
  active = v;
}
