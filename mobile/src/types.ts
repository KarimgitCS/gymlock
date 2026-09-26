export interface Set {
  id: string;
  exercise_id: string;
  weight: number;
  reps: number;
  set_number: number;
  completed_at: string;
}

export interface ExercisePlan {
  sets: number;
  reps: number;
  weight: number;
}

export interface Exercise {
  id: string;
  workout_id: string;
  name: string;
  order: number;
  // Target from the preset this workout was started from; absent for ad-hoc exercises.
  plan?: ExercisePlan | null;
  sets: Set[];
}

export type WorkoutStatus = "planned" | "active" | "done";

export interface RestState {
  // Absolute end time (epoch ms), so the countdown survives backgrounding and reloads.
  ends_at: number;
  total: number;
}

export interface Workout {
  id: string;
  date: string;
  // Preset name when started from a saved session.
  name?: string | null;
  notes: string | null;
  // Missing on workouts logged before setup/active modes existed; treated as done.
  status?: WorkoutStatus;
  started_at?: string | null;
  finished_at?: string | null;
  rest?: RestState | null;
  // Local edit time (epoch ms); the newer edit wins when devices sync.
  updated_at: number;
  exercises: Exercise[];
}

export interface PresetExercise extends ExercisePlan {
  name: string;
}

export interface Preset {
  id: string;
  name: string;
  exercises: PresetExercise[];
  updated_at: number;
}
