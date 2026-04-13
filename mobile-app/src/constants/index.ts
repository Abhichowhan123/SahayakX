// ─── Theme ────────────────────────────────────────────────────────────────────
export const COLORS = {
  primary:        '#7ED321',   // ServeEase green (matches screenshot)
  primaryDark:    '#5FA818',
  primaryLight:   '#A8E05A',
  background:     '#F8F9FA',
  white:          '#FFFFFF',
  black:          '#1A1A1A',
  textPrimary:    '#1A1A1A',
  textSecondary:  '#6B7280',
  textMuted:      '#9CA3AF',
  border:         '#E5E7EB',
  error:          '#EF4444',
  success:        '#10B981',
  warning:        '#F59E0B',
  cardBg:         '#FFFFFF',
  inputBg:        '#F3F4F6',
  shadow:         '#000000',
};

export const FONTS = {
  regular:   'System',
  medium:    'System',
  bold:      'System',
  sizes: {
    xs:   11,
    sm:   13,
    base: 15,
    md:   17,
    lg:   20,
    xl:   24,
    xxl:  30,
  },
};

export const SPACING = {
  xs:   4,
  sm:   8,
  md:   16,
  lg:   24,
  xl:   32,
  xxl:  48,
};

export const BORDER_RADIUS = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  full: 9999,
};

// ─── Service Categories ───────────────────────────────────────────────────────
export const SERVICE_CATEGORIES = [
  { id: 'house_maid',   label: 'House Maid',    icon: '🧹', color: '#FFE4E1', hasSubTypes: false },
  { id: 'garden_work',  label: 'Garden Work',   icon: '🌱', color: '#E1F5E1', hasSubTypes: false },
  { id: 'construction', label: 'Construction',  icon: '🏗️', color: '#FFF3E0', hasSubTypes: true  },
  { id: 'electrician',  label: 'Electrician',   icon: '⚡', color: '#FFFDE7', hasSubTypes: false },
  { id: 'plumber',      label: 'Plumber',       icon: '🔧', color: '#E3F2FD', hasSubTypes: false },
  { id: 'home_teacher', label: 'Home Teacher',  icon: '📚', color: '#F3E5F5', hasSubTypes: true  },
  { id: 'gym_trainer',  label: 'Gym Trainer',   icon: '💪', color: '#FCE4EC', hasSubTypes: false },
  { id: 'cook',         label: 'Cook',          icon: '🍳', color: '#FFF8E1', hasSubTypes: false },
  { id: 'driver',       label: 'Driver',        icon: '🚗', color: '#E8EAF6', hasSubTypes: false },
  { id: 'babysitter',   label: 'Babysitter',    icon: '👶', color: '#E0F7FA', hasSubTypes: false },
  { id: 'pet_care',     label: 'Pet Care',      icon: '🐾', color: '#F1F8E9', hasSubTypes: false },
  { id: 'ac_technician',label: 'AC Technician', icon: '❄️', color: '#E0F2F1', hasSubTypes: false },
];

export const CONSTRUCTION_SUBTYPES = ['Carpenter', 'Trowel/Mistri', 'Welder', 'Painter', 'Mason'];
export const TEACHER_SUBJECTS      = ['Mathematics', 'Science', 'English', 'Hindi', 'Computer', 'Music', 'Art', 'Physics', 'Chemistry', 'Biology'];
