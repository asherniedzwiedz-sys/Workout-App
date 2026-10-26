import { router } from 'expo-router';
import { ExerciseList } from '@/ExerciseList';

export default function ExercisesTab() {
  return <ExerciseList onSelect={(e) => router.push({ pathname: '/exercise/[id]', params: { id: e.id } })} />;
}
