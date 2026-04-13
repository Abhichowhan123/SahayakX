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
  OFFER_SENT             = 'offer_sent',
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
  [ServiceCategory.CONSTRUCTION]:  ['Carpenter', 'Trowel/Mistri', 'Welder', 'Painter', 'Mason'],
  [ServiceCategory.HOME_TEACHER]:  ['Mathematics', 'Science', 'English', 'Hindi', 'Computer',
                                    'Music', 'Art', 'Physics', 'Chemistry', 'Biology'],
  [ServiceCategory.GARDEN_WORK]:   ['Lawn Mowing', 'Tree Trimming', 'Garden Design', 'Watering System'],
  [ServiceCategory.COOK]:          ['Indian', 'Continental', 'Baking', 'Party Catering', 'Diet Cook'],
  [ServiceCategory.GYM_TRAINER]:   ['Weight Loss', 'Muscle Building', 'Yoga', 'Zumba', 'CrossFit'],
  [ServiceCategory.ELECTRICIAN]:   ['Wiring', 'Appliance Repair', 'Solar Panel', 'CCTV Installation'],
  [ServiceCategory.PLUMBER]:       ['Pipe Repair', 'Bathroom Fitting', 'Water Tank', 'Drainage'],
  [ServiceCategory.HOUSE_MAID]:    ['Daily Cleaning', 'Part-time', 'Full-time', 'Deep Cleaning'],
  [ServiceCategory.DRIVER]:        ['Daily Driver', 'Outstation', 'Airport Drop', 'School Run'],
  [ServiceCategory.PEST_CONTROL]:  ['Cockroach', 'Termite', 'Bed Bugs', 'Rodents', 'General Pest'],
  [ServiceCategory.AC_TECHNICIAN]: ['AC Service', 'AC Repair', 'AC Installation', 'Gas Refill'],
  [ServiceCategory.BABYSITTER]:    ['Newborn Care', 'Toddler', 'After School', 'Weekend'],
  [ServiceCategory.PET_CARE]:      ['Dog Walking', 'Pet Grooming', 'Pet Sitting', 'Vet Escort'],
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
