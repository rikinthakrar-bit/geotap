import { Button, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 22, marginBottom: 10 }}>GeoTap</Text>
      <Button title="Play Daily Challenge" onPress={() => alert('Coming soon!')} />
    </View>
  );
}