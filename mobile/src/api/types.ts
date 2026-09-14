export interface Set {
  id: number;
  exercise_id: number;
  weight: number;
  reps: number;
  set_number: number;
  completed_at: string;
}

export interface Exercise {
  id: number;
  workout_id: number;
  name: string;
  order: number;
  sets: Set[];
}

export interface Workout {
  id: number;
  date: string;
  notes: string | null;
  exercises: Exercise[];
}

export interface Token {
  access_token: string;
  token_type: string;
}
