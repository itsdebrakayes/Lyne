import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { colors, v3 } from '../../lib/mobileV3Styles';
import { demoBranches } from '../../lib/prototypeData';
import { BranchRow, MiniTabBar } from './HomeScreen';

export default function SavedScreen() {
  const saved = [demoBranches[0], demoBranches[2], demoBranches[4]];
  return (
    <View style={v3.root}>
      <ScrollView contentContainerStyle={v3.content} showsVerticalScrollIndicator={false}>
        <Text style={[v3.h2, { marginBottom: 18 }]}>Saved</Text>
        {saved.map((branch) => <BranchRow key={branch.id} branch={branch} />)}
        <Text style={{ marginTop: 18, color: colors.muted, fontWeight: '600', lineHeight: 20 }}>
          Saved branches stay one tap away and keep live wait times visible before you leave.
        </Text>
      </ScrollView>
      <MiniTabBar active="Saved" />
    </View>
  );
}
