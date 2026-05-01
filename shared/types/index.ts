import { ObjectId } from 'mongodb';

// ─── Enums ───────────────────────────────────────────────────────────────────

export enum ServiceCategory {
  HOUSE_MAID    = 'house_maid',
  GARDEN_WORK   = 'garden_work',
  CONSTRUCTION  = 'construction',
  ELECTRICIAN   = 'electrician',
  PLUMBER       = 'plumber',
  HOME_TEACHER  = 'home_teacher',
  GYM_TRAINER   = 'gym_trainer',
  COOK          = 'cook',
  DRIVER        = 'driver',
  PEST_CONTROL  = 'pest_control',
  AC_TECHNICIAN = 'ac_technician',
  BABYSITTER    = 'babysitter',
  PET_CARE      = 'pet_care',
}

export enum BookingStatus {
  SEARCHING              = 'searching',
  ACCEPTED               = 'accepted',
  WORKER_EN_ROUTE        = 'worker_en_route',
  IN_PROGRESS            = 'in_progress',
  COMPLETED              = 'completed',
  CANCELLED_BY_CUSTOMER  = 'cancelled_by_customer',
  CANCELLED_BY_WORKER    = 'cancelled_by_worker',
  DISPUTED               = 'disputed',
  EXPIRED                = 'expired',
}

export enum PaymentMethod {
  CARD          = 'card',
  UPI           = 'upi',
  NET_BANKING   = 'net_banking',
  WALLET        = 'wallet',
  CASH          = 'cash',
}

export enum PaymentStatus {
  PENDING         = 'pending',
  HELD_IN_ESCROW  = 'held_in_escrow',
  RELEASED        = 'released',
  REFUNDED        = 'refunded',
  FAILED          = 'failed',
}

export enum VerificationStatus {
  PENDING  = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

export enum UserRole {
  CUSTOMER = 'customer',
  WORKER   = 'worker',
  ADMIN    = 'admin',
}

// ─── Sub-types ───────────────────────────────────────────────────────────────

export const SERVICE_SUBTYPES: Record<ServiceCategory, string[]> = {
  [ServiceCategory.HOUSE_MAID]:    ['Cooking', 'Cleaning', 'Laundry', 'Dishwashing', 'Elder Care', 'Child Care', 'Deep Cleaning'],
  [ServiceCategory.GARDEN_WORK]:   ['Lawn Mowing', 'Landscaping', 'Plant Care', 'Tree Trimming', 'Irrigation Setup', 'Terrace Garden'],
  [ServiceCategory.CONSTRUCTION]:  ['Masonry', 'Carpentry', 'Painting', 'Flooring', 'Tiling', 'Roofing', 'Plastering', 'Demolition', 'Welding'],
  [ServiceCategory.ELECTRICIAN]:   ['Wiring', 'Appliance Repair', 'Switchboard', 'CCTV Installation', 'Home Automation', 'Solar Panel'],
  [ServiceCategory.PLUMBER]:       ['Pipe Fitting', 'Leak Repair', 'Bathroom Fitting', 'Water Heater', 'Drainage', 'Bore Well'],
  [ServiceCategory.HOME_TEACHER]:  ['Mathematics', 'Science', 'English', 'Hindi', 'Physics', 'Chemistry', 'Biology',
                                    'History', 'Geography', 'Economics', 'Commerce', 'Computer', 'Art', 'Music', 'Dance'],
  [ServiceCategory.GYM_TRAINER]:   ['Weight Training', 'Yoga', 'Zumba', 'Cardio', 'CrossFit', 'Pilates', 'Boxing', 'Calisthenics', 'Nutrition Coaching'],
  [ServiceCategory.COOK]:          ['North Indian', 'South Indian', 'Bengali', 'Punjabi', 'Chinese', 'Continental', 'Italian', 'Baking', 'Biryani'],
  [ServiceCategory.DRIVER]:        ['Personal Driver', 'School Van', 'Outstation', 'Airport Drop', 'Delivery', 'Cab'],
  [ServiceCategory.PEST_CONTROL]:  ['Cockroach', 'Termite', 'Rodent/Rat', 'Bed Bugs', 'Mosquito', 'Ants', 'Bees/Wasps', 'General Fumigation'],
  [ServiceCategory.AC_TECHNICIAN]: ['Installation', 'Repair', 'Cleaning/Service', 'Gas Refilling', 'Uninstallation'],
  [ServiceCategory.BABYSITTER]:    ['Newborn (0–1y)', 'Toddler (1–3y)', 'Preschool (3–5y)', 'School-age (5–12y)'],
  [ServiceCategory.PET_CARE]:      ['Dog Walking', 'Grooming', 'Pet Sitting/Boarding', 'Training', 'Vet Assistance', 'Aquarium Care'],
};

// ─── Shared Interfaces ───────────────────────────────────────────────────────

export interface IAddress {
  label: string;           // "Home", "Work", "Other"
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface IGeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface IWallet {
  balance: number;
  currency: string;
  totalEarned?: number;
  totalSpent?: number;
}

export interface IPricing {
  hourlyRate: number;
  dailyRate?: number;
  minimumHours: number;
  currency: string;
  isNegotiable: boolean;
  suggestedFares?: number[]; // e.g. [110, 120, 130] shown in modal
}

// ─── API Response Wrapper ────────────────────────────────────────────────────

export interface IApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── Events (RabbitMQ message shapes) ────────────────────────────────────────

export interface IBookingCreatedEvent {
  bookingId: string;
  customerId: string;
  workerId: string;
  serviceCategory: ServiceCategory;
  totalAmount: number;
  customerPhone: string;
  workerPhone: string;
}

export interface IBookingStatusChangedEvent {
  bookingId: string;
  oldStatus: BookingStatus;
  newStatus: BookingStatus;
  customerId: string;
  workerId: string;
}

export interface IPaymentEvent {
  bookingId: string;
  transactionId: string;
  amount: number;
  status: PaymentStatus;
  workerId: string;
  customerId: string;
}

export interface IPenaltyEvent {
  bookingId: string;
  cancelledBy: 'customer' | 'worker';
  userId: string;
  penaltyAmount: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const CANCELLATION_RULES = {
  penaltyPercent:                    0.10,   // 10% of booking amount
  workerFreeWindowMinutes:           5,
  customerFreeWindowMinutes:         10,
  workerAcceptanceTimeoutSeconds:    120,    // 2 min to accept/reject
  maxCancellationsBeforeSuspension:  3,
  suspensionDays:                    7,
} as const;

export const PLATFORM_CONFIG = {
  commissionPercent:   0.12,  // 12% platform fee
  taxPercent:          0.18,  // GST 18%
  minBookingAmount:    50,
  currency:            'INR',
  otpExpiryMinutes:    5,
} as const;
