

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>مرآة</Text>
      <Text style={styles.subtitle}>تخيّلها… اصنعها</Text>
      <Text style={styles.message}>
        أهلاً بك في عالم القصص والإبداع
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101827',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 23,
    color: '#41D9C5',
    marginTop: 12,
  },
  message: {
    fontSize: 17,
    color: '#FFFFFF',
    marginTop: 24,
    textAlign: 'center',
  },
});
