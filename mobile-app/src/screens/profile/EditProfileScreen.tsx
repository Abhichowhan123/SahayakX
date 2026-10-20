import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, SafeAreaView, Platform,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation';
import { userApi, workerApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { SPACING, BORDER_RADIUS, FONTS, SERVICE_SUBTYPES_MAP } from '../../constants';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/theme';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'EditProfile'> };

// ─── Static config (mirrors ProfileSetupScreen) ───────────────────────────────
type FieldType = 'multi' | 'single' | 'toggle' | 'number';
interface ExtraField { key: string; label: string; type: FieldType; options?: string[] }
interface CategoryConfig { subTypesLabel: string; subTypes: string[]; extras: ExtraField[] }

const CATEGORIES = [
  { value: 'house_maid',    label: '🧹 House Maid' },
  { value: 'garden_work',   label: '🌱 Garden Work' },
  { value: 'construction',  label: '🏗️ Construction' },
  { value: 'electrician',   label: '⚡ Electrician' },
  { value: 'plumber',       label: '🔧 Plumber' },
  { value: 'home_teacher',  label: '📚 Home Teacher' },
  { value: 'gym_trainer',   label: '💪 Gym Trainer' },
  { value: 'cook',          label: '🍳 Cook' },
  { value: 'driver',        label: '🚗 Driver' },
  { value: 'pest_control',  label: '🐜 Pest Control' },
  { value: 'ac_technician', label: '❄️ AC Technician' },
  { value: 'babysitter',    label: '👶 Babysitter' },
  { value: 'pet_care',      label: '🐾 Pet Care' },
];

const LANGUAGES = ['Hindi', 'English', 'Tamil', 'Telugu', 'Bengali', 'Marathi', 'Kannada', 'Malayalam', 'Gujarati', 'Punjabi', 'Odia', 'Urdu'];
const DAYS      = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SHIFTS    = ['Morning (6am–12pm)', 'Afternoon (12pm–6pm)', 'Evening (6pm–10pm)', 'Full Day'];

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  house_maid: {
    subTypesLabel: 'Services Offered',
    subTypes: SERVICE_SUBTYPES_MAP.house_maid,
    extras: [{ key: 'workType', label: 'Work Type', type: 'single', options: ['Full-time', 'Part-time', 'Live-in'] }],
  },
  garden_work: {
    subTypesLabel: 'Specialization',
    subTypes: SERVICE_SUBTYPES_MAP.garden_work,
    extras: [
      { key: 'gardenType', label: 'Garden Type', type: 'multi', options: ['Home Garden', 'Terrace', 'Farm', 'Large Estate'] },
      { key: 'ownTools',   label: 'I have my own tools', type: 'toggle' },
    ],
  },
  construction: {
    subTypesLabel: 'Specialization',
    subTypes: SERVICE_SUBTYPES_MAP.construction,
    extras: [
      { key: 'workType',     label: 'Work Type',     type: 'multi', options: ['New Construction', 'Renovation', 'Repair'] },
      { key: 'projectScale', label: 'Project Scale', type: 'multi', options: ['Residential', 'Commercial'] },
    ],
  },
  electrician: {
    subTypesLabel: 'Specialization',
    subTypes: SERVICE_SUBTYPES_MAP.electrician,
    extras: [
      { key: 'workScale', label: 'Work Scale', type: 'multi', options: ['Residential', 'Commercial', 'Industrial'] },
      { key: 'licensed',  label: 'I have a valid electrician license', type: 'toggle' },
      { key: 'emergency', label: 'Available for emergencies (24x7)', type: 'toggle' },
    ],
  },
  plumber: {
    subTypesLabel: 'Specialization',
    subTypes: SERVICE_SUBTYPES_MAP.plumber,
    extras: [{ key: 'emergency', label: 'Available for emergencies (24x7)', type: 'toggle' }],
  },
  home_teacher: {
    subTypesLabel: 'Subjects',
    subTypes: SERVICE_SUBTYPES_MAP.home_teacher,
    extras: [
      { key: 'grades',       label: 'Classes / Grades',             type: 'multi',  options: ['1–5', '6–8', '9–10', '11–12', 'Graduation', 'JEE/NEET', 'UPSC/Govt Exams'] },
      { key: 'boards',       label: 'Boards',                       type: 'multi',  options: ['CBSE', 'ICSE', 'State Board', 'IB'] },
      { key: 'mode',         label: 'Teaching Mode',                type: 'multi',  options: ['Home Visit', 'Online', 'At My Place'] },
      { key: 'maxStudents',  label: 'Max students per batch',       type: 'number' },
      { key: 'specialNeeds', label: 'I teach special needs students', type: 'toggle' },
    ],
  },
  gym_trainer: {
    subTypesLabel: 'Specialization',
    subTypes: SERVICE_SUBTYPES_MAP.gym_trainer,
    extras: [
      { key: 'goalFocus',        label: 'Goal Focus',        type: 'multi',  options: ['Weight Loss', 'Muscle Building', 'Rehabilitation', 'Sports Fitness'] },
      { key: 'trainingLocation', label: 'Training Location', type: 'multi',  options: ['Home Visit', 'Gym', 'Park', 'Online'] },
      { key: 'trainsGender',     label: 'Trains',            type: 'single', options: ['Male', 'Female', 'Both'] },
      { key: 'certified',        label: 'I am a certified trainer', type: 'toggle' },
    ],
  },
  cook: {
    subTypesLabel: 'Cuisine',
    subTypes: SERVICE_SUBTYPES_MAP.cook,
    extras: [
      { key: 'dietType',      label: 'Diet Type',    type: 'multi',  options: ['Veg Only', 'Non-veg', 'Jain', 'All Types'] },
      { key: 'mealService',   label: 'Meal Service', type: 'multi',  options: ['Breakfast', 'Lunch', 'Dinner', 'Full Day', 'Tiffin Service'] },
      { key: 'eventCatering', label: 'Available for events & parties', type: 'toggle' },
    ],
  },
  driver: {
    subTypesLabel: 'Service Type',
    subTypes: SERVICE_SUBTYPES_MAP.driver,
    extras: [
      { key: 'licenseType',   label: 'License Type',          type: 'multi',  options: ['LMV (Car/Jeep)', 'HMV (Truck/Bus)'] },
      { key: 'hasOwnVehicle', label: 'I have my own vehicle', type: 'toggle' },
      { key: 'vehicleType',   label: 'Vehicle Type (if own)', type: 'multi',  options: ['2-Wheeler', '4-Wheeler', 'Commercial Vehicle'] },
    ],
  },
  pest_control: {
    subTypesLabel: 'Pest Types Handled',
    subTypes: SERVICE_SUBTYPES_MAP.pest_control,
    extras: [
      { key: 'treatment',    label: 'Treatment Method', type: 'multi', options: ['Chemical', 'Herbal/Organic'] },
      { key: 'propertyType', label: 'Property Type',    type: 'multi', options: ['Residential', 'Commercial', 'Industrial'] },
    ],
  },
  ac_technician: {
    subTypesLabel: 'Services',
    subTypes: SERVICE_SUBTYPES_MAP.ac_technician,
    extras: [
      { key: 'acTypes', label: 'AC Types',           type: 'multi', options: ['Window', 'Split', 'Cassette', 'Central', 'Industrial'] },
      { key: 'brands',  label: 'Brands Experienced', type: 'multi', options: ['LG', 'Samsung', 'Voltas', 'Daikin', 'Hitachi', 'Blue Star', 'Carrier', 'Panasonic'] },
    ],
  },
  babysitter: {
    subTypesLabel: 'Age Groups',
    subTypes: SERVICE_SUBTYPES_MAP.babysitter,
    extras: [
      { key: 'services', label: 'Services', type: 'multi', options: ['Feeding', 'Bathing', 'Educational Activities', 'Nighttime Care', 'Homework Help'] },
      { key: 'liveIn',   label: 'Available as live-in babysitter', type: 'toggle' },
      { key: 'firstAid', label: 'I am first aid certified', type: 'toggle' },
    ],
  },
  pet_care: {
    subTypesLabel: 'Services',
    subTypes: SERVICE_SUBTYPES_MAP.pet_care,
    extras: [
      { key: 'animals',      label: 'Animals Handled',          type: 'multi', options: ['Dogs', 'Cats', 'Birds', 'Fish', 'Rabbits', 'Reptiles'] },
      { key: 'dogSize',      label: 'Dog Size (if applicable)', type: 'multi', options: ['Small', 'Medium', 'Large'] },
      { key: 'vaccinations', label: 'I can handle vaccinations', type: 'toggle' },
    ],
  },
};

// Reconstruct structured extras from the flat skills[] stored in the DB
function rebuildExtras(skills: string[], catCfg: CategoryConfig | undefined) {
  const extraFields: Record<string, string | string[]> = {};
  const extraNumbers: Record<string, string>           = {};
  if (!catCfg) return { extraFields, extraNumbers };
  for (const field of catCfg.extras) {
    if (field.type === 'toggle') {
      extraFields[field.key] = skills.includes(field.label) ? 'yes' : 'no';
    } else if (field.type === 'number') {
      const prefix = `${field.label}: `;
      const match  = skills.find(s => s.startsWith(prefix));
      if (match) extraNumbers[field.key] = match.replace(prefix, '');
    } else if (field.type === 'multi') {
      extraFields[field.key] = (field.options || []).filter(opt => skills.includes(opt));
    } else {
      extraFields[field.key] = (field.options || []).find(opt => skills.includes(opt)) || '';
    }
  }
  return { extraFields, extraNumbers };
}

function buildSkills(catCfg: CategoryConfig | undefined, extraFields: Record<string, string | string[]>, extraNumbers: Record<string, string>): string[] {
  if (!catCfg) return [];
  const result: string[] = [];
  for (const field of catCfg.extras) {
    const val = extraFields[field.key];
    if (field.type === 'toggle') {
      if (val === 'yes') result.push(field.label);
    } else if (field.type === 'number') {
      const num = extraNumbers[field.key];
      if (num) result.push(`${field.label}: ${num}`);
    } else if (Array.isArray(val)) {
      result.push(...val);
    } else if (typeof val === 'string' && val) {
      result.push(val);
    }
  }
  return result;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function EditProfileScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { colors: themeColors } = useTheme();
  const isWorker = user?.role === 'worker';

  // Basic
  const [fullName, setFullName] = useState('');
  const [email,    setEmail]    = useState('');
  const [bio,      setBio]      = useState('');

  // Worker service
  const [serviceCategory,  setServiceCategory]  = useState('');
  const [serviceSubTypes,  setServiceSubTypes]  = useState<string[]>([]);
  const [experience,       setExperience]       = useState('');
  const [hourlyRate,       setHourlyRate]       = useState('');
  const [extraFields,      setExtraFields]      = useState<Record<string, string | string[]>>({});
  const [extraNumbers,     setExtraNumbers]     = useState<Record<string, string>>({});

  // Availability
  const [languages,     setLanguages]     = useState<string[]>([]);
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [shift,         setShift]         = useState('');

  // Location
  const [serviceArea,     setServiceArea]     = useState('');
  const [locationLoading, setLocationLoading] = useState(false);

  // UI
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const catConfig = CATEGORY_CONFIG[serviceCategory];

  useEffect(() => {
    setLoading(true);
    const fetch = isWorker ? workerApi.getMyProfile() : userApi.getProfile();
    fetch
      .then(res => {
        const d = res.data.data;
        setFullName(d?.fullName || '');
        setEmail(d?.email || '');
        setBio(d?.bio || '');
        if (isWorker) {
          const cat = d?.serviceCategory || '';
          setServiceCategory(cat);
          setServiceSubTypes(d?.serviceSubTypes || []);
          setExperience(String(d?.experience || ''));
          setHourlyRate(String(d?.pricing?.hourlyRate || ''));
          setLanguages(d?.languages || []);
          setAvailableDays(d?.availability?.days || []);
          setShift(d?.availability?.shift || '');
          setServiceArea(d?.serviceArea || '');
          const { extraFields: ef, extraNumbers: en } = rebuildExtras(d?.skills || [], CATEGORY_CONFIG[cat]);
          setExtraFields(ef);
          setExtraNumbers(en);
        }
      })
      .catch((err: any) => {
        // 404 means the worker registered via auth but hasn't completed profile setup yet
        // Show empty form so they can fill it in and save
        if (err?.response?.status !== 404) {
          setError('Failed to load profile. Pull down to retry.');
        }
      })
      .finally(() => setLoading(false));
  }, [isWorker]);

  // When category changes, reset subTypes and extras
  const handleCategoryChange = (cat: string) => {
    setServiceCategory(cat);
    setServiceSubTypes([]);
    setExtraFields({});
    setExtraNumbers({});
  };

  const toggleArr = (arr: string[], item: string, setter: (v: string[]) => void) =>
    setter(arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]);

  const setMulti = (key: string, val: string) => {
    const prev = (extraFields[key] as string[] | undefined) || [];
    setExtraFields(f => ({ ...f, [key]: prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val] }));
  };
  const setSingle = (key: string, val: string) => setExtraFields(f => ({ ...f, [key]: val }));
  const setToggle = (key: string, val: 'yes' | 'no') => setExtraFields(f => ({ ...f, [key]: val }));

  const handleGetLocation = async () => {
    setLocationLoading(true);
    setError('');
    try {
      if (
        Platform.OS === 'web' &&
        typeof window !== 'undefined' &&
        window.location.protocol !== 'https:' &&
        window.location.hostname !== 'localhost'
      ) {
        setError('Location detection needs HTTPS. Open the app at http://localhost:8081 or type your area manually.');
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setError('Location permission denied. Enter area manually.'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [addr] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (addr) {
        const parts = [addr.name, addr.street, addr.district || addr.subregion, addr.city].filter(Boolean);
        setServiceArea(parts.join(', '));
      }
    } catch {
      setError('Could not detect location. Enter your area manually.');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSave = async () => {
    setError('');
    if (!fullName.trim()) { setError('Name is required'); return; }
    if (isWorker && !serviceCategory) { setError('Please select a service category'); return; }
    setSaving(true);
    try {
      if (isWorker) {
        const workerPayload = {
          fullName:        fullName.trim(),
          bio:             bio.trim(),
          serviceCategory,
          serviceSubTypes,
          skills:          buildSkills(catConfig, extraFields, extraNumbers),
          experience:      parseInt(experience, 10) || 0,
          pricing:         { hourlyRate: parseFloat(hourlyRate) || 0, isNegotiable: true },
          languages,
          availability:    { days: availableDays, shift },
          serviceArea:     serviceArea.trim(),
        };
        try {
          await workerApi.updateMyProfile(workerPayload);
        } catch (updateErr: any) {
          if (updateErr?.response?.status === 404) {
            // Profile doesn't exist yet — create it
            await workerApi.register(workerPayload);
          } else {
            throw updateErr;
          }
        }
      } else {
        await userApi.updateProfile({ fullName: fullName.trim(), email: email.trim() });
      }
      if (Platform.OS === 'web') {
        window.alert('Profile updated successfully');
      } else {
        Alert.alert('Success', 'Profile updated successfully');
      }
      navigation.goBack();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={themeColors.primary} />
      </View>
    );
  }

  // ─── Customer view ────────────────────────────────────────────────────────
  if (!isWorker) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.heading}>Edit Profile</Text>
          <Text style={styles.label}>Full Name</Text>
          <TextInput style={styles.input} value={fullName} onChangeText={setFullName}
            placeholder="Enter your full name" placeholderTextColor={colors.textMuted} />
          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail}
            placeholder="Enter your email" placeholderTextColor={colors.textMuted}
            keyboardType="email-address" autoCapitalize="none" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Worker view ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Edit Profile</Text>

        {/* ── Basic Info ── */}
        <Text style={styles.sectionTitle}>Basic Info</Text>
        <Text style={styles.label}>Full Name *</Text>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName}
          placeholder="Your full name" placeholderTextColor={colors.textMuted} />
        <Text style={styles.label}>Bio</Text>
        <TextInput style={[styles.input, styles.multiline]} value={bio} onChangeText={setBio}
          placeholder="Tell customers about yourself" placeholderTextColor={colors.textMuted}
          multiline numberOfLines={3} />

        {/* ── Category ── */}
        <Text style={styles.sectionTitle}>Service Category</Text>
        <View style={styles.chipsWrap}>
          {CATEGORIES.map(c => (
            <TouchableOpacity
              key={c.value}
              style={[styles.chip, serviceCategory === c.value && styles.chipActive]}
              onPress={() => handleCategoryChange(c.value)}
            >
              <Text style={[styles.chipText, serviceCategory === c.value && styles.chipTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Specializations ── */}
        {catConfig && (
          <>
            <Text style={styles.sectionTitle}>{catConfig.subTypesLabel}</Text>
            <View style={styles.chipsWrap}>
              {catConfig.subTypes.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, serviceSubTypes.includes(s) && styles.chipActive]}
                  onPress={() => toggleArr(serviceSubTypes, s, setServiceSubTypes)}
                >
                  <Text style={[styles.chipText, serviceSubTypes.includes(s) && styles.chipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* ── Experience & Rate ── */}
        <Text style={styles.sectionTitle}>Experience & Rate</Text>
        <Text style={styles.label}>Years of Experience *</Text>
        <TextInput style={styles.input} value={experience} onChangeText={setExperience}
          placeholder="e.g. 3" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
        <Text style={styles.label}>Hourly Rate (₹) *</Text>
        <TextInput style={styles.input} value={hourlyRate} onChangeText={setHourlyRate}
          placeholder="e.g. 300" placeholderTextColor={colors.textMuted} keyboardType="numeric" />

        {/* ── Category-specific extras ── */}
        {catConfig && catConfig.extras.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Details</Text>
            {catConfig.extras.map(field => (
              <View key={field.key} style={styles.extraBlock}>
                <Text style={styles.label}>{field.label}</Text>

                {(field.type === 'multi' || field.type === 'single') && field.options && (
                  <View style={styles.chipsWrap}>
                    {field.options.map(opt => {
                      const val    = extraFields[field.key];
                      const active = field.type === 'multi'
                        ? (Array.isArray(val) && val.includes(opt))
                        : val === opt;
                      return (
                        <TouchableOpacity
                          key={opt}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => field.type === 'multi' ? setMulti(field.key, opt) : setSingle(field.key, opt)}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {field.type === 'toggle' && (
                  <View style={styles.toggleRow}>
                    {(['yes', 'no'] as const).map(v => (
                      <TouchableOpacity
                        key={v}
                        style={[styles.toggleBtn, extraFields[field.key] === v && styles.toggleBtnActive]}
                        onPress={() => setToggle(field.key, v)}
                      >
                        <Text style={[styles.toggleBtnText, extraFields[field.key] === v && styles.toggleBtnTextActive]}>
                          {v === 'yes' ? 'Yes' : 'No'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {field.type === 'number' && (
                  <TextInput
                    style={styles.input}
                    value={extraNumbers[field.key] || ''}
                    onChangeText={v => setExtraNumbers(n => ({ ...n, [field.key]: v }))}
                    placeholder="Enter number"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                  />
                )}
              </View>
            ))}
          </>
        )}

        {/* ── Languages ── */}
        <Text style={styles.sectionTitle}>Languages Spoken</Text>
        <View style={styles.chipsWrap}>
          {LANGUAGES.map(l => (
            <TouchableOpacity
              key={l}
              style={[styles.chip, languages.includes(l) && styles.chipActive]}
              onPress={() => toggleArr(languages, l, setLanguages)}
            >
              <Text style={[styles.chipText, languages.includes(l) && styles.chipTextActive]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Availability ── */}
        <Text style={styles.sectionTitle}>Availability</Text>
        <Text style={styles.label}>Working Days</Text>
        <View style={styles.chipsWrap}>
          {DAYS.map(d => (
            <TouchableOpacity
              key={d}
              style={[styles.chip, availableDays.includes(d) && styles.chipActive]}
              onPress={() => toggleArr(availableDays, d, setAvailableDays)}
            >
              <Text style={[styles.chipText, availableDays.includes(d) && styles.chipTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Preferred Shift</Text>
        <View style={styles.chipsWrap}>
          {SHIFTS.map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.chip, shift === s && styles.chipActive]}
              onPress={() => setShift(s)}
            >
              <Text style={[styles.chipText, shift === s && styles.chipTextActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Location ── */}
        <Text style={styles.sectionTitle}>Service Location</Text>
        <Text style={styles.label}>Service Area</Text>
        <TextInput
          style={styles.input}
          value={serviceArea}
          onChangeText={setServiceArea}
          placeholder="e.g. Koramangala, Bangalore"
          placeholderTextColor={colors.textMuted}
        />
        <TouchableOpacity style={styles.gpsBtn} onPress={handleGetLocation} disabled={locationLoading}>
          {locationLoading
            ? <ActivityIndicator size="small" color={themeColors.primary} />
            : <Text style={styles.gpsBtnText}>📍 Detect My Location</Text>}
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: colors.background },
  center:            { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content:           { padding: SPACING.lg },
  heading:           { fontSize: FONTS.sizes.xl, fontWeight: '700', color: colors.textPrimary, marginBottom: SPACING.lg },
  sectionTitle:      { fontSize: FONTS.sizes.sm, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  label:             { fontSize: FONTS.sizes.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: SPACING.xs },
  input:             { backgroundColor: colors.inputBg, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, fontSize: FONTS.sizes.base, color: colors.textPrimary, marginBottom: SPACING.md, borderWidth: 1, borderColor: colors.border },
  multiline:         { height: 90, textAlignVertical: 'top' },
  chipsWrap:         { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.md },
  chip:              { paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: BORDER_RADIUS.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.inputBg },
  chipActive:        { borderColor: colors.primary, backgroundColor: colors.primary + '15' },
  chipText:          { fontSize: FONTS.sizes.sm, color: colors.textSecondary, fontWeight: '500' },
  chipTextActive:    { color: colors.primary, fontWeight: '700' },
  extraBlock:        { marginBottom: SPACING.sm },
  toggleRow:         { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  toggleBtn:         { flex: 1, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.inputBg },
  toggleBtnActive:   { borderColor: colors.primary, backgroundColor: colors.primary + '15' },
  toggleBtnText:     { fontSize: FONTS.sizes.sm, color: colors.textMuted, fontWeight: '600' },
  toggleBtnTextActive: { color: colors.primary },
  gpsBtn:            { borderWidth: 1.5, borderColor: colors.primary, borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.sm, alignItems: 'center', marginBottom: SPACING.md },
  gpsBtnText:        { fontSize: FONTS.sizes.sm, fontWeight: '700', color: colors.primary },
  error:             { color: colors.error, fontSize: FONTS.sizes.sm, marginBottom: SPACING.md, textAlign: 'center' },
  saveBtn:           { backgroundColor: colors.primary, borderRadius: BORDER_RADIUS.full, paddingVertical: SPACING.md, alignItems: 'center', marginBottom: SPACING.sm },
  saveBtnText:       { fontSize: FONTS.sizes.base, fontWeight: '700', color: colors.white },
  cancelBtn:         { borderRadius: BORDER_RADIUS.full, paddingVertical: SPACING.md, alignItems: 'center' },
  cancelBtnText:     { fontSize: FONTS.sizes.base, fontWeight: '600', color: colors.textSecondary },
});
