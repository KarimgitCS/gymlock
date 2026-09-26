import type { Preset } from "../types";

// Fixed ids and updated_at 0: every device seeds identical starters, so signing in on a second
// device merges them instead of duplicating them, and any edit or delete (newer) wins over them.
export const STARTER_PRESETS: Preset[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Push Day",
    updated_at: 0,
    exercises: [
      { name: "Bench Press", sets: 4, reps: 8, weight: 135 },
      { name: "Overhead Press", sets: 3, reps: 10, weight: 75 },
      { name: "Incline Dumbbell Press", sets: 3, reps: 10, weight: 50 },
      { name: "Tricep Pushdown", sets: 3, reps: 12, weight: 40 },
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Pull Day",
    updated_at: 0,
    exercises: [
      { name: "Deadlift", sets: 3, reps: 5, weight: 185 },
      { name: "Barbell Row", sets: 4, reps: 8, weight: 115 },
      { name: "Lat Pulldown", sets: 3, reps: 10, weight: 100 },
      { name: "Bicep Curl", sets: 3, reps: 12, weight: 30 },
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    name: "Leg Day",
    updated_at: 0,
    exercises: [
      { name: "Squat", sets: 4, reps: 8, weight: 155 },
      { name: "Romanian Deadlift", sets: 3, reps: 10, weight: 115 },
      { name: "Leg Press", sets: 3, reps: 12, weight: 200 },
      { name: "Calf Raise", sets: 4, reps: 15, weight: 100 },
    ],
  },
];
