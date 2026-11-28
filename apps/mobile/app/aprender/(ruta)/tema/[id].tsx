import { useLocalSearchParams } from 'expo-router';
import { Lesson } from '../../../../src/learn/Lesson';

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Lesson id={id} />;
}
