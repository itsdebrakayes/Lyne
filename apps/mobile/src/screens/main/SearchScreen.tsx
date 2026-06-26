import React from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, v3 } from '../../lib/mobileV3Styles';
import { demoBranches } from '../../lib/prototypeData';
import { BranchRow, MiniTabBar } from './HomeScreen';

export default function SearchScreen() {
  const navigation = useNavigation<any>();
  return (
    <View style={v3.root}>
      <ScrollView contentContainerStyle={v3.content} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={[v3.search, { flex: 1, height: 46, borderRadius: 14 }]}>
            <Ionicons name="search-outline" size={17} color={colors.text} />
            <TextInput style={v3.searchText} value="Kingston agencies" editable={false} />
          </View>
          <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.featured, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="options-outline" size={18} color="#fff" />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 18 }}>
          {['Government  ×', 'Kingston  ×', 'Open now  ×'].map((filter) => (
            <View key={filter} style={[v3.chip, v3.chipActive]}><Text style={v3.chipTextActive}>{filter}</Text></View>
          ))}
        </ScrollView>

        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>Search results</Text>
          <Text style={v3.small}>{demoBranches.length} branches</Text>
        </View>

        {demoBranches.map((branch, index) => <BranchRow key={branch.id} branch={branch} dark={index % 3 === 0} />)}
      </ScrollView>
      <MiniTabBar active="Search" />
    </View>
  );
}
