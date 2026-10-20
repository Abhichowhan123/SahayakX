import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { userApi, workerApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/theme';
import { SPACING, BORDER_RADIUS, FONTS, SERVICE_SUBTYPES_MAP } from '../../constants';

// ─── Config types ─────────────────────────────────────────────────────────────
type FieldType = 'multi' | 'single' | 'toggle' | 'number';
interface ExtraField { key: string; label: string; type: FieldType; options?: string[] }
interface CategoryConfig { subTypesLabel: string; subTypes: string[]; extras: ExtraField[] }

// ─── Static data ──────────────────────────────────────────────────────────────
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

const LANGUAGES     = ['Hindi', 'English', 'Tamil', 'Telugu', 'Bengali', 'Marathi', 'Kannada', 'Malayalam', 'Gujarati', 'Punjabi', 'Odia', 'Urdu'];
const DAYS          = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SHIFTS        = ['Morning (6am–12pm)', 'Afternoon (12pm–6pm)', 'Evening (6pm–10pm)', 'Full Day'];
const TOTAL_STEPS   = 5;

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  house_maid: {
    subTypesLabel: 'Services Offered',
    subTypes: SERVICE_SUBTYPES_MAP.house_maid,
    extras: [
      { key: 'workType', label: 'Work Type', type: 'single', options: ['Full-time', 'Part-time', 'Live-in'] },
    ],
  },
  garden_work: {
    subTypesLabel: 'Specialization',
    subTypes: SERVICE_SUBTYPES_MAP.garden_work,
    extras: [
      { key: 'gardenType', label: 'Garden Type', type: 'multi',  options: ['Home Garden', 'Terrace', 'Farm', 'Large Estate'] },
      { key: 'ownTools',   label: 'I have my own tools',         type: 'toggle' },
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
      { key: 'workScale', label: 'Work Scale',                      type: 'multi',  options: ['Residential', 'Commercial', 'Industrial'] },
      { key: 'licensed',  label: 'I have a valid electrician license', type: 'toggle' },
      { key: 'emergency', label: 'Available for emergencies (24x7)', type: 'toggle' },
    ],
  },
  plumber: {
    subTypesLabel: 'Specialization',
    subTypes: SERVICE_SUBTYPES_MAP.plumber,
    extras: [
      { key: 'emergency', label: 'Available for emergencies (24x7)', type: 'toggle' },
    ],
  },
  home_teacher: {
    subTypesLabel: 'Subjects',
    subTypes: SERVICE_SUBTYPES_MAP.home_teacher,
    extras: [
      { key: 'grades',      label: 'Classes / Grades',        type: 'multi',  options: ['1–5', '6–8', '9–10', '11–12', 'Graduation', 'JEE/NEET', 'UPSC/Govt Exams'] },
      { key: 'boards',      label: 'Boards',                  type: 'multi',  options: ['CBSE', 'ICSE', 'State Board', 'IB'] },
      { key: 'mode',        label: 'Teaching Mode',           type: 'multi',  options: ['Home Visit', 'Online', 'At My Place'] },
      { key: 'maxStudents', label: 'Max students per batch',  type: 'number' },
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
      { key: 'services', label: 'Services',                         type: 'multi',  options: ['Feeding', 'Bathing', 'Educational Activities', 'Nighttime Care', 'Homework Help'] },
      { key: 'liveIn',   label: 'Available as live-in babysitter',  type: 'toggle' },
      { key: 'firstAid', label: 'I am first aid certified',         type: 'toggle' },
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

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ProfileSetupScreen() {
  const { completeProfileSetup, user } = useAuth();
  const { colors: themeColors } = useTheme();
  const isWorker = user?.role === 'worker';

  // Step nav
  const [step, setStep] = useState(1);

  // Step 1 — Basics
  const [fullName, setFullName] = useState('');
  const [bio,      setBio]      = useState('');

  // Step 2 — Category
  const [serviceCategory, setServiceCategory] = useState('');

  // Step 3 — Specializations
  const [serviceSubTypes, setServiceSubTypes]   = useState<string[]>([]);
  const [extraFields,     setExtraFields]       = useState<Record<string, string | string[]>>({});
  const [extraNumbers,    setExtraNumbers]      = useState<Record<string, string>>({});

  // Step 4 — Details
  const [experience,    setExperience]    = useState('');
  const [hourlyRate,    setHourlyRate]    = useState('');
  const [languages,     setLanguages]     = useState<string[]>([]);
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [shift,         setShift]         = useState('');

  // Step 5 — Location
  const [serviceArea,     setServiceArea]     = useState('');
  const [locationCoords,  setLocationCoords]  = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  // Customer only
  const [email, setEmail] = useState('');

  // UI
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const catConfig = CATEGORY_CONFIG[serviceCategory];

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const toggleArr = (arr: string[], item: string, setter: (v: string[]) => void) =>
    setter(arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]);

  const setMulti = (key: string, val: string) => {
    const prev = (extraFields[key] as string[] | undefined) || [];
    setExtraFields(f => ({ ...f, [key]: prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val] }));
  };

  const setSingle = (key: string, val: string) =>
    setExtraFields(f => ({ ...f, [key]: val }));

  const setToggle = (key: string, val: 'yes' | 'no') =>
    setExtraFields(f => ({ ...f, [key]: val }));

  const buildSkills = (): string[] => {
    if (!catConfig) return [];
    const result: string[] = [];
    for (const field of catConfig.extras) {
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
  };

  // ─── Validation ────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    setError('');
    if (step === 1 && !fullName.trim())        { setError('Please enter your full name'); return false; }
    if (step === 2 && !serviceCategory)        { setError('Please select your service category'); return false; }
    if (step === 3 && !serviceSubTypes.length) {
      setError(`Please select at least one ${catConfig?.subTypesLabel?.toLowerCase() || 'specialization'}`);
      return false;
    }
    if (step === 4 && !experience)  { setError('Please enter your years of experience'); return false; }
    if (step === 4 && !hourlyRate)  { setError('Please enter your hourly rate'); return false; }
    if (step === 5 && !serviceArea.trim()) { setError('Please enter your service area'); return false; }
    return true;
  };

  const handleNext = () => { if (validate()) { setError(''); setStep(s => s + 1); } };
  const handleBack = () => { setError(''); setStep(s => s - 1); };

  // ─── GPS location ──────────────────────────────────────────────────────────
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
      const loc  = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [addr] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (addr) {
        const parts = [addr.name, addr.street, addr.district || addr.subregion, addr.city].filter(Boolean);
        setServiceArea(parts.join(', '));
      }
      setLocationCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch {
      setError('Could not detect location. Enter your area manually.');
    } finally {
      setLocationLoading(false);
    }
  };

  // ─── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (isWorker) {
        const payload: Record<string, unknown> = {
          fullName:       fullName.trim(),
          bio:            bio.trim(),
          serviceCategory,
          serviceSubTypes,
          skills:         buildSkills(),
          experience:     parseInt(experience, 10) || 0,
          pricing:        { hourlyRate: parseFloat(hourlyRate) || 0, isNegotiable: true },
          languages,
          availability:   { days: availableDays, shift },
          serviceArea:    serviceArea.trim(),
        };
        if (locationCoords) payload.location = locationCoords;
        await workerApi.register(payload);
      } else {
        await userApi.updateProfile({ fullName: fullName.trim(), email: email.trim() });
      }
      completeProfileSetup();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Pill renderer ─────────────────────────────────────────────────────────
  const PillGroup = ({
    items, selected, onPress,
  }: { items: string[]; selected: string[]; onPress: (v: string) => void }) => (
    <View style={styles.pillGrid}>
      {items.map(item => {
        const active = selected.includes(item);
        return (
          <TouchableOpacity key={item} style={[styles.pill, active && { borderColor: themeColors.primary, backgroundColor: themeColors.primary + '20' }]} onPress={() => onPress(item)}>
            <Text style={[styles.pillText, { color: themeColors.textMuted }, active && { color: themeColors.primary, fontWeight: '700' }]}>{item}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ─── Customer form ─────────────────────────────────────────────────────────
  if (!isWorker) {
    return (
      <KeyboardAvoidingView style={[styles.container, { backgroundColor: themeColors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.iconBox}><Text style={styles.icon}>👋</Text></View>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>Complete Your Profile</Text>
          <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>Just a couple of details to get started.</Text>

          <Text style={[styles.label, { color: themeColors.textSecondary }]}>Full Name *</Text>
          <TextInput style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]} value={fullName} onChangeText={setFullName}
            placeholder="Enter your full name" placeholderTextColor={themeColors.textMuted} autoCapitalize="words" />

          <Text style={[styles.label, { color: themeColors.textSecondary }]}>Email (optional)</Text>
          <TextInput style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]} value={email} onChangeText={setEmail}
            placeholder="Enter your email" placeholderTextColor={themeColors.textMuted}
            keyboardType="email-address" autoCapitalize="none" />

          {error ? <Text style={[styles.error, { color: themeColors.error }]}>{error}</Text> : null}

          <TouchableOpacity style={[styles.btn, styles.btnStatic, { backgroundColor: themeColors.primary }]} onPress={handleSubmit} disabled={saving}>
            {saving ? <ActivityIndicator color={themeColors.white} /> : <Text style={[styles.btnText, { color: themeColors.white }]}>Get Started</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── Step content ──────────────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <>
            <Text style={[styles.stepTitle, { color: themeColors.textPrimary }]}>👋 Let's set up your profile</Text>
            <Text style={[styles.stepSubtitle, { color: themeColors.textSecondary }]}>Tell customers about yourself</Text>

            <Text style={[styles.label, { color: themeColors.textSecondary }]}>Full Name *</Text>
            <TextInput style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]} value={fullName} onChangeText={setFullName}
              placeholder="Enter your full name" placeholderTextColor={themeColors.textMuted} autoCapitalize="words" />

            <Text style={[styles.label, { color: themeColors.textSecondary }]}>About You (optional)</Text>
            <TextInput style={[styles.input, styles.multiline, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]} value={bio} onChangeText={setBio}
              placeholder="Describe your experience and why customers should hire you..."
              placeholderTextColor={themeColors.textMuted} multiline numberOfLines={4} />
          </>
        );

      case 2:
        return (
          <>
            <Text style={[styles.stepTitle, { color: themeColors.textPrimary }]}>🔖 What service do you offer?</Text>
            <Text style={[styles.stepSubtitle, { color: themeColors.textSecondary }]}>Select your main service category</Text>
            <PillGroup
              items={CATEGORIES.map(c => c.label)}
              selected={serviceCategory ? [CATEGORIES.find(c => c.value === serviceCategory)?.label ?? ''] : []}
              onPress={(label) => {
                const cat = CATEGORIES.find(c => c.label === label);
                if (cat) { setServiceCategory(cat.value); setServiceSubTypes([]); setExtraFields({}); }
              }}
            />
          </>
        );

      case 3: {
        if (!catConfig) return null;
        return (
          <>
            <Text style={[styles.stepTitle, { color: themeColors.textPrimary }]}>📋 Your Specializations</Text>
            <Text style={[styles.stepSubtitle, { color: themeColors.textSecondary }]}>Select all that apply</Text>

            <Text style={[styles.label, { color: themeColors.textSecondary }]}>{catConfig.subTypesLabel} *</Text>
            <PillGroup items={catConfig.subTypes} selected={serviceSubTypes}
              onPress={v => toggleArr(serviceSubTypes, v, setServiceSubTypes)} />

            {catConfig.extras.map(field => (
              <View key={field.key} style={styles.fieldBlock}>
                <Text style={[styles.label, { color: themeColors.textSecondary }]}>{field.label}</Text>

                {field.type === 'multi' && (
                  <PillGroup
                    items={field.options!}
                    selected={(extraFields[field.key] as string[]) || []}
                    onPress={v => setMulti(field.key, v)}
                  />
                )}

                {field.type === 'single' && (
                  <PillGroup
                    items={field.options!}
                    selected={extraFields[field.key] ? [extraFields[field.key] as string] : []}
                    onPress={v => setSingle(field.key, v)}
                  />
                )}

                {field.type === 'toggle' && (
                  <View style={styles.toggleRow}>
                    {(['yes', 'no'] as const).map(val => (
                      <TouchableOpacity
                        key={val}
                        style={[styles.toggleBtn, extraFields[field.key] === val && { borderColor: themeColors.primary, backgroundColor: themeColors.primary + '20' }]}
                        onPress={() => setToggle(field.key, val)}
                      >
                        <Text style={[styles.toggleText, { color: themeColors.textMuted }, extraFields[field.key] === val && { color: themeColors.primary }]}>
                          {val === 'yes' ? '✓  Yes' : '✗  No'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {field.type === 'number' && (
                  <TextInput
                    style={[styles.input, { marginBottom: SPACING.sm, backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                    value={extraNumbers[field.key] || ''}
                    onChangeText={v => setExtraNumbers(n => ({ ...n, [field.key]: v }))}
                    placeholder="Enter number"
                    placeholderTextColor={themeColors.textMuted}
                    keyboardType="number-pad"
                  />
                )}
              </View>
            ))}
          </>
        );
      }

      case 4:
        return (
          <>
            <Text style={[styles.stepTitle, { color: themeColors.textPrimary }]}>💼 Experience & Availability</Text>
            <Text style={[styles.stepSubtitle, { color: themeColors.textSecondary }]}>Help customers know when and how much</Text>

            <Text style={[styles.label, { color: themeColors.textSecondary }]}>Years of Experience *</Text>
            <TextInput style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]} value={experience} onChangeText={setExperience}
              placeholder="e.g. 3" placeholderTextColor={themeColors.textMuted} keyboardType="number-pad" />

            <Text style={[styles.label, { color: themeColors.textSecondary }]}>Hourly Rate (₹) *</Text>
            <TextInput style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]} value={hourlyRate} onChangeText={setHourlyRate}
              placeholder="e.g. 300" placeholderTextColor={themeColors.textMuted} keyboardType="decimal-pad" />

            <Text style={[styles.label, { color: themeColors.textSecondary }]}>Languages Spoken</Text>
            <PillGroup items={LANGUAGES} selected={languages}
              onPress={v => toggleArr(languages, v, setLanguages)} />

            <Text style={[styles.label, { color: themeColors.textSecondary }]}>Available Days</Text>
            <PillGroup items={DAYS} selected={availableDays}
              onPress={v => toggleArr(availableDays, v, setAvailableDays)} />

            <Text style={[styles.label, { color: themeColors.textSecondary }]}>Preferred Shift</Text>
            <PillGroup items={SHIFTS} selected={shift ? [shift] : []}
              onPress={v => setShift(v)} />
          </>
        );

      case 5:
        return (
          <>
            <Text style={[styles.stepTitle, { color: themeColors.textPrimary }]}>📍 Your Service Area</Text>
            <Text style={[styles.stepSubtitle, { color: themeColors.textSecondary }]}>Where are you available to work?</Text>

            <TouchableOpacity style={[styles.locationBtn, { borderColor: themeColors.primary, backgroundColor: themeColors.primary + '10' }]} onPress={handleGetLocation} disabled={locationLoading}>
              {locationLoading
                ? <ActivityIndicator color={themeColors.primary} />
                : <Text style={[styles.locationBtnText, { color: themeColors.primary }]}>📡  Detect My Current Location</Text>}
            </TouchableOpacity>

            <Text style={[styles.orDivider, { color: themeColors.textMuted }]}>— or enter manually —</Text>

            <Text style={[styles.label, { color: themeColors.textSecondary }]}>City / Area / Neighbourhood *</Text>
            <TextInput style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]} value={serviceArea} onChangeText={setServiceArea}
              placeholder="e.g. Koramangala, Bangalore" placeholderTextColor={themeColors.textMuted} />

            {locationCoords && (
              <Text style={[styles.locationDetected, { color: themeColors.success }]}>✓  GPS coordinates captured for precise matching</Text>
            )}
          </>
        );

      default: return null;
    }
  };

  // ─── Worker multi-step wrapper ─────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: themeColors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* Progress bar */}
      <View style={styles.progressWrap}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <View key={i} style={[styles.progressSeg, i < step && { backgroundColor: themeColors.primary }]} />
        ))}
      </View>
      <Text style={[styles.progressLabel, { color: themeColors.textMuted }]}>Step {step} of {TOTAL_STEPS}</Text>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {renderStep()}

        {error ? <Text style={[styles.error, { color: themeColors.error }]}>{error}</Text> : null}

        <View style={styles.navRow}>
          {step > 1 && (
            <TouchableOpacity style={[styles.backBtn, { borderColor: themeColors.border }]} onPress={handleBack}>
              <Text style={[styles.backBtnText, { color: themeColors.textSecondary }]}>← Back</Text>
            </TouchableOpacity>
          )}

          {step < TOTAL_STEPS ? (
            <TouchableOpacity style={[styles.btn, { backgroundColor: themeColors.primary }, step > 1 && styles.btnShrink]} onPress={handleNext}>
              <Text style={[styles.btnText, { color: themeColors.white }]}>Next →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.btn, { backgroundColor: themeColors.primary }, styles.btnShrink]} onPress={handleSubmit} disabled={saving}>
              {saving
                ? <ActivityIndicator color={themeColors.white} />
                : <Text style={[styles.btnText, { color: themeColors.white }]}>Register</Text>}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:          { flex: 1 },
  scroll:             { flexGrow: 1, padding: SPACING.lg, paddingTop: SPACING.sm },

  // Progress
  progressWrap:       { flexDirection: 'row', gap: 4, paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg },
  progressSeg:        { flex: 1, height: 4, borderRadius: 2 },
  progressLabel:      { textAlign: 'center', fontSize: FONTS.sizes.xs, marginTop: 6, marginBottom: SPACING.md },

  // Step header
  stepTitle:          { fontSize: FONTS.sizes.xl, fontWeight: '800', marginBottom: SPACING.xs },
  stepSubtitle:       { fontSize: FONTS.sizes.sm, marginBottom: SPACING.lg, lineHeight: 20 },

  // Labels
  label:              { fontSize: FONTS.sizes.sm, fontWeight: '600', marginBottom: SPACING.xs },

  // Inputs
  input:              { borderRadius: BORDER_RADIUS.md, padding: SPACING.md, fontSize: FONTS.sizes.base, marginBottom: SPACING.md, borderWidth: 1 },
  multiline:          { height: 100, textAlignVertical: 'top' },

  // Pills
  pillGrid:           { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.lg },
  pill:               { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, borderWidth: 1.5 },
  pillText:           { fontSize: FONTS.sizes.sm, fontWeight: '500' },

  // Toggle (yes/no)
  fieldBlock:         { marginBottom: SPACING.xs },
  toggleRow:          { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  toggleBtn:          { flex: 1, paddingVertical: SPACING.sm + 2, borderRadius: BORDER_RADIUS.md, borderWidth: 1.5, alignItems: 'center' },
  toggleText:         { fontSize: FONTS.sizes.sm, fontWeight: '600' },

  // Location
  locationBtn:        { borderWidth: 1.5, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, alignItems: 'center', marginBottom: SPACING.md },
  locationBtnText:    { fontSize: FONTS.sizes.base, fontWeight: '700' },
  locationDetected:   { fontSize: FONTS.sizes.xs, marginBottom: SPACING.md },
  orDivider:          { textAlign: 'center', fontSize: FONTS.sizes.xs, marginBottom: SPACING.md },

  // Navigation
  navRow:             { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md, marginBottom: SPACING.xl },
  backBtn:            { flex: 1, borderWidth: 1.5, borderRadius: BORDER_RADIUS.full, paddingVertical: SPACING.md, alignItems: 'center' },
  backBtnText:        { fontSize: FONTS.sizes.base, fontWeight: '600' },
  btn:                { flex: 1, borderRadius: BORDER_RADIUS.full, paddingVertical: SPACING.md + 2, alignItems: 'center' },
  btnShrink:          { flex: 2 },
  // For buttons that sit directly in a ScrollView (column): `flex: 1` would
  // stretch them to fill the remaining height instead of hugging the label.
  btnStatic:          { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  btnText:            { fontSize: FONTS.sizes.md, fontWeight: '700' },

  // Customer-only
  iconBox:            { alignItems: 'center', marginBottom: SPACING.lg },
  icon:               { fontSize: 64 },
  title:              { fontSize: FONTS.sizes.xl, fontWeight: '800', textAlign: 'center', marginBottom: SPACING.sm },
  subtitle:           { fontSize: FONTS.sizes.base, textAlign: 'center', marginBottom: SPACING.xl, lineHeight: 22 },

  // Error
  error:              { fontSize: FONTS.sizes.sm, marginBottom: SPACING.sm, textAlign: 'center' },
});
