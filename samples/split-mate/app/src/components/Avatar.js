import { StyleSheet, Text, View } from 'react-native';
import { avatarColors } from '../theme';

// A coloured circle with the member's initial. The colour comes from the
// member's id, so the same person always gets the same colour.
export default function Avatar({ member, size = 40 }) {
  const name = member?.name ?? '?';
  const color = colorFor(member?.id ?? name);

  return (
    <View
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: color + '22' }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[styles.initial, { color, fontSize: size * 0.42 }]}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

function colorFor(id) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  return avatarColors[hash % avatarColors.length];
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontWeight: '800',
  },
});
