import express        from 'express';
import cors           from 'cors';
import helmet         from 'helmet';
import { createClient } from 'redis';
import dotenv         from 'dotenv';
import { ServiceCategory, SERVICE_SUBTYPES, PLATFORM_CONFIG } from '@serveease/shared/types';
import { success } from '@serveease/shared/utils';

dotenv.config();

const app    = express();
const PORT   = parseInt(process.env.PORT || '3004', 10);
let   redis: ReturnType<typeof createClient>;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'catalog-service' }));

// ─── GET /catalog/categories ─────────────────────────────────────────────────
app.get('/catalog/categories', async (_req, res) => {
  const CACHE_KEY = 'catalog:categories';
  const cached    = await redis.get(CACHE_KEY);
  if (cached) { res.json(JSON.parse(cached)); return; }

  const categories = Object.values(ServiceCategory).map(cat => ({
    id:       cat,
    label:    cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    subTypes: SERVICE_SUBTYPES[cat] || [],
    icon:     getCategoryIcon(cat),
    description: getCategoryDescription(cat),
  }));

  const response = success(categories, 'Categories fetched');
  await redis.setEx(CACHE_KEY, 86400, JSON.stringify(response)); // cache 24h
  res.json(response);
});

// ─── GET /catalog/categories/:category ───────────────────────────────────────
app.get('/catalog/categories/:category', async (req, res) => {
  const { category } = req.params;
  const subTypes = SERVICE_SUBTYPES[category as ServiceCategory];

  if (!subTypes) { res.status(404).json({ success: false, message: 'Category not found' }); return; }

  res.json(success({
    id:       category,
    subTypes,
    icon:        getCategoryIcon(category as ServiceCategory),
    description: getCategoryDescription(category as ServiceCategory),
    pricingGuideline: getPricingGuideline(category as ServiceCategory),
  }));
});

// ─── GET /catalog/pricing ─────────────────────────────────────────────────────
app.get('/catalog/pricing', (_req, res) => {
  const pricing: Record<string, { minHourly: number; maxHourly: number; minDaily: number; maxDaily: number }> = {
    house_maid:   { minHourly: 80,  maxHourly: 200,  minDaily: 400,  maxDaily: 1000 },
    garden_work:  { minHourly: 100, maxHourly: 250,  minDaily: 500,  maxDaily: 1500 },
    construction: { minHourly: 150, maxHourly: 500,  minDaily: 700,  maxDaily: 2500 },
    electrician:  { minHourly: 200, maxHourly: 600,  minDaily: 800,  maxDaily: 3000 },
    plumber:      { minHourly: 200, maxHourly: 600,  minDaily: 800,  maxDaily: 3000 },
    home_teacher: { minHourly: 200, maxHourly: 1000, minDaily: 800,  maxDaily: 4000 },
    gym_trainer:  { minHourly: 300, maxHourly: 1500, minDaily: 1000, maxDaily: 5000 },
    cook:         { minHourly: 150, maxHourly: 500,  minDaily: 600,  maxDaily: 2500 },
    driver:       { minHourly: 100, maxHourly: 300,  minDaily: 500,  maxDaily: 1500 },
    babysitter:   { minHourly: 100, maxHourly: 400,  minDaily: 400,  maxDaily: 2000 },
  };
  res.json(success(pricing, 'Pricing guidelines fetched'));
});

// ─── GET /catalog/config ──────────────────────────────────────────────────────
app.get('/catalog/config', (_req, res) => {
  res.json(success(PLATFORM_CONFIG, 'Platform config'));
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getCategoryIcon(cat: ServiceCategory): string {
  const icons: Record<string, string> = {
    house_maid: '🧹', garden_work: '🌱', construction: '🏗️',
    electrician: '⚡', plumber: '🔧', home_teacher: '📚',
    gym_trainer: '💪', cook: '🍳', driver: '🚗',
    pest_control: '🐜', ac_technician: '❄️', babysitter: '👶', pet_care: '🐾',
  };
  return icons[cat] || '🔨';
}

function getCategoryDescription(cat: ServiceCategory): string {
  const desc: Record<string, string> = {
    house_maid:   'Professional home cleaning and household chores',
    garden_work:  'Garden maintenance, lawn mowing, and landscaping',
    construction: 'Construction, carpentry, welding, and masonry work',
    electrician:  'Electrical wiring, repairs, and installations',
    plumber:      'Pipe repairs, bathroom fittings, and drainage solutions',
    home_teacher: 'Private tutoring for all subjects and age groups',
    gym_trainer:  'Personal fitness training at your home',
    cook:         'Home cooking, party catering, and meal prep',
    driver:       'Personal driver for daily commute or outstation trips',
    babysitter:   'Trusted childcare and babysitting services',
    pet_care:     'Dog walking, grooming, and pet sitting',
  };
  return desc[cat] || 'Professional service at your doorstep';
}

function getPricingGuideline(cat: ServiceCategory): string {
  const guide: Record<string, string> = {
    house_maid:   'Typically ₹80-200/hr. Full-day (8hr) ₹400-1000.',
    electrician:  'Minimum visit charge ₹200. Complex work billed hourly.',
    home_teacher: '₹200-1000/hr based on subject & qualification.',
    gym_trainer:  '₹300-1500/hr. Monthly packages available.',
  };
  return guide[cat] || 'Price varies based on work type and experience.';
}

const start = async () => {
  redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  await redis.connect();
  console.log('[Catalog Service] Redis connected');
  app.listen(PORT, () => console.log(`[Catalog Service] Running on port ${PORT}`));
};

start().catch(err => { console.error(err); process.exit(1); });
