import { ExerciseList, resolvePick } from '@/ExerciseList';

export default function PickExercise() {
  return <ExerciseList onSelect={(e) => resolvePick(e.id)} />;
}
