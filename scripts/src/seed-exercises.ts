import { db, exercisesTable } from "@workspace/db";

const exercises = [
  // Chest
  { name: "Bench Press", muscleGroup: "Chest", category: "Strength" },
  { name: "Incline Bench Press", muscleGroup: "Chest", category: "Strength" },
  { name: "Decline Bench Press", muscleGroup: "Chest", category: "Strength" },
  { name: "Dumbbell Fly", muscleGroup: "Chest", category: "Strength" },
  { name: "Push-Up", muscleGroup: "Chest", category: "Bodyweight" },
  { name: "Cable Fly", muscleGroup: "Chest", category: "Strength" },
  // Back
  { name: "Deadlift", muscleGroup: "Back", category: "Strength" },
  { name: "Pull-Up", muscleGroup: "Back", category: "Bodyweight" },
  { name: "Barbell Row", muscleGroup: "Back", category: "Strength" },
  { name: "Lat Pulldown", muscleGroup: "Back", category: "Strength" },
  { name: "Seated Cable Row", muscleGroup: "Back", category: "Strength" },
  { name: "T-Bar Row", muscleGroup: "Back", category: "Strength" },
  { name: "Dumbbell Row", muscleGroup: "Back", category: "Strength" },
  // Shoulders
  { name: "Overhead Press", muscleGroup: "Shoulders", category: "Strength" },
  { name: "Dumbbell Shoulder Press", muscleGroup: "Shoulders", category: "Strength" },
  { name: "Lateral Raise", muscleGroup: "Shoulders", category: "Strength" },
  { name: "Front Raise", muscleGroup: "Shoulders", category: "Strength" },
  { name: "Arnold Press", muscleGroup: "Shoulders", category: "Strength" },
  { name: "Face Pull", muscleGroup: "Shoulders", category: "Strength" },
  // Legs
  { name: "Squat", muscleGroup: "Legs", category: "Strength" },
  { name: "Front Squat", muscleGroup: "Legs", category: "Strength" },
  { name: "Leg Press", muscleGroup: "Legs", category: "Strength" },
  { name: "Romanian Deadlift", muscleGroup: "Legs", category: "Strength" },
  { name: "Leg Curl", muscleGroup: "Legs", category: "Strength" },
  { name: "Leg Extension", muscleGroup: "Legs", category: "Strength" },
  { name: "Calf Raise", muscleGroup: "Legs", category: "Strength" },
  { name: "Lunge", muscleGroup: "Legs", category: "Strength" },
  { name: "Bulgarian Split Squat", muscleGroup: "Legs", category: "Strength" },
  // Arms
  { name: "Barbell Curl", muscleGroup: "Biceps", category: "Strength" },
  { name: "Dumbbell Curl", muscleGroup: "Biceps", category: "Strength" },
  { name: "Hammer Curl", muscleGroup: "Biceps", category: "Strength" },
  { name: "Preacher Curl", muscleGroup: "Biceps", category: "Strength" },
  { name: "Tricep Pushdown", muscleGroup: "Triceps", category: "Strength" },
  { name: "Skull Crusher", muscleGroup: "Triceps", category: "Strength" },
  { name: "Overhead Tricep Extension", muscleGroup: "Triceps", category: "Strength" },
  { name: "Close-Grip Bench Press", muscleGroup: "Triceps", category: "Strength" },
  // Core
  { name: "Plank", muscleGroup: "Core", category: "Bodyweight" },
  { name: "Crunch", muscleGroup: "Core", category: "Bodyweight" },
  { name: "Ab Rollout", muscleGroup: "Core", category: "Bodyweight" },
  { name: "Russian Twist", muscleGroup: "Core", category: "Bodyweight" },
  { name: "Hanging Leg Raise", muscleGroup: "Core", category: "Bodyweight" },
  // Cardio
  { name: "Treadmill Run", muscleGroup: "Cardio", category: "Cardio" },
  { name: "Rowing Machine", muscleGroup: "Cardio", category: "Cardio" },
  { name: "Cycling", muscleGroup: "Cardio", category: "Cardio" },
];

async function seed() {
  console.log("Seeding exercises...");
  await db.insert(exercisesTable).values(exercises).onConflictDoNothing();
  console.log(`Seeded ${exercises.length} exercises.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
