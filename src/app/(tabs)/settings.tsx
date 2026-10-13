import { View } from 'react-native';

import { EmptyState } from '@/components/ui';
import { colors } from '@/theme';

export default function Placeholder() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <EmptyState icon="construct-outline" title="Coming soon" />
    </View>
  );
}
