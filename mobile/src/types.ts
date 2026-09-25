export interface Set {
  id: number;
  exercise_id: number;
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
  id: number;
  workout_id: number;
  name: string;
  order: number;
  // Target from the preset this workout was started from; absent for ad-hoc exercises.
  plan?: ExercisePlan | null;
  sets: Set[];
}

export interface Workout {
  id: number;
  date: string;
  // Preset name when started from a saved session.
  name?: string | null;
  notes: string | null;
  exercises: Exercise[];
}

export interface PresetExercise extends ExercisePlan {
  name: string;
}

export interface Preset {
  id: number;
  name: string;
  exercises: PresetExercise[];
}
