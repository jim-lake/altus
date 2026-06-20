import { StatusBar, StyleSheet, Text, View } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: 'black',
    fontSize: 30,
  },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle='light-content' />
      <View style={styles.container}>
        <Text style={styles.text}>Test2</Text>
      </View>
    </SafeAreaProvider>
  );
}
