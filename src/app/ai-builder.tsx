import { View } from 'react-native';

import { EmptyState } from '@/components/ui';
import { colors } from '@/theme';

export default function AiBuilderScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <EmptyState icon="sparkles-outline" title="Coming soon" />
    </View>
  );
}
