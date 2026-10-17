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
  { id: 'house_maid',    label: 'House Maid',     icon: '🧹', color: '#FFE4E1', hasSubTypes: true },
  { id: 'garden_work',   label: 'Garden Work',    icon: '🌱', color: '#E1F5E1', hasSubTypes: true },
  { id: 'construction',  label: 'Construction',   icon: '🏗️', color: '#FFF3E0', hasSubTypes: true },
  { id: 'electrician',   label: 'Electrician',    icon: '⚡', color: '#FFFDE7', hasSubTypes: true },
  { id: 'plumber',       label: 'Plumber',        icon: '🔧', color: '#E3F2FD', hasSubTypes: true },
  { id: 'home_teacher',  label: 'Home Teacher',   icon: '📚', color: '#F3E5F5', hasSubTypes: true },
  { id: 'gym_trainer',   label: 'Gym Trainer',    icon: '💪', color: '#FCE4EC', hasSubTypes: true },
  { id: 'cook',          label: 'Cook',           icon: '🍳', color: '#FFF8E1', hasSubTypes: true },
  { id: 'driver',        label: 'Driver',         icon: '🚗', color: '#E8EAF6', hasSubTypes: true },
  { id: 'pest_control',  label: 'Pest Control',   icon: '🪲', color: '#FFF9C4', hasSubTypes: true },
  { id: 'ac_technician', label: 'AC Technician',  icon: '❄️', color: '#E0F2F1', hasSubTypes: true },
  { id: 'babysitter',    label: 'Babysitter',     icon: '👶', color: '#E0F7FA', hasSubTypes: true },
  { id: 'pet_care',      label: 'Pet Care',       icon: '🐾', color: '#F1F8E9', hasSubTypes: true },
];

export const CONSTRUCTION_SUBTYPES = ['Masonry', 'Carpentry', 'Painting', 'Flooring', 'Tiling', 'Roofing', 'Plastering', 'Demolition', 'Welding'];
export const TEACHER_SUBTYPES      = ['Mathematics', 'Science', 'English', 'Hindi', 'Physics', 'Chemistry', 'Biology',
                                     'History', 'Geography', 'Economics', 'Commerce', 'Computer', 'Art', 'Music', 'Dance'];
export const GARDEN_SUBTYPES       = ['Lawn Mowing', 'Landscaping', 'Plant Care', 'Tree Trimming', 'Irrigation Setup', 'Terrace Garden'];
export const ELECTRICIAN_SUBTYPES  = ['Wiring', 'Appliance Repair', 'Switchboard', 'CCTV Installation', 'Home Automation', 'Solar Panel'];
export const PLUMBER_SUBTYPES      = ['Pipe Fitting', 'Leak Repair', 'Bathroom Fitting', 'Water Heater', 'Drainage', 'Bore Well'];
export const MAID_SUBTYPES         = ['Cooking', 'Cleaning', 'Laundry', 'Dishwashing', 'Elder Care', 'Child Care', 'Deep Cleaning'];
export const GYM_SUBTYPES          = ['Weight Training', 'Yoga', 'Zumba', 'Cardio', 'CrossFit', 'Pilates', 'Boxing', 'Calisthenics', 'Nutrition Coaching'];
export const COOK_SUBTYPES          = ['North Indian', 'South Indian', 'Bengali', 'Punjabi', 'Chinese', 'Continental', 'Italian', 'Baking', 'Biryani'];
export const DRIVER_SUBTYPES       = ['Personal Driver', 'School Van', 'Outstation', 'Airport Drop', 'Delivery', 'Cab'];
export const PEST_SUBTYPES         = ['Cockroach', 'Termite', 'Rodent/Rat', 'Bed Bugs', 'Mosquito', 'Ants', 'Bees/Wasps', 'General Fumigation'];
export const AC_SUBTYPES           = ['Installation', 'Repair', 'Cleaning/Service', 'Gas Refilling', 'Uninstallation'];
export const BABYSITTER_SUBTYPES   = ['Newborn (0–1y)', 'Toddler (1–3y)', 'Preschool (3–5y)', 'School-age (5–12y)'];
export const PET_CARE_SUBTYPES     = ['Dog Walking', 'Grooming', 'Pet Sitting/Boarding', 'Training', 'Vet Assistance', 'Aquarium Care'];

export const SERVICE_SUBTYPES_MAP: Record<string, string[]> = {
  house_maid: MAID_SUBTYPES,
  garden_work: GARDEN_SUBTYPES,
  construction: CONSTRUCTION_SUBTYPES,
  electrician: ELECTRICIAN_SUBTYPES,
  plumber: PLUMBER_SUBTYPES,
  home_teacher: TEACHER_SUBTYPES,
  gym_trainer: GYM_SUBTYPES,
  cook: COOK_SUBTYPES,
  driver: DRIVER_SUBTYPES,
  pest_control: PEST_SUBTYPES,
  ac_technician: AC_SUBTYPES,
  babysitter: BABYSITTER_SUBTYPES,
  pet_care: PET_CARE_SUBTYPES,
};
