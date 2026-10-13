// Apple Health writes, with the HealthKit native module and DB mocked.

const mockSave = jest.fn(async () => ({}));
const mockAuth = jest.fn(async () => true);
let mockExpoGo = false;
let mockSettings = { healthSync: true, bodyWeightLbs: 176.37 as number | null };
const mockMarked: string[] = [];

jest.mock('../runtime', () => ({
  get isExpoGo() {
    return mockExpoGo;
  },
}));
jest.mock('@kingstinct/react-native-healthkit', () => ({
  isHealthDataAvailable: () => true,
  requestAuthorization: mockAuth,
  saveWorkoutSample: mockSave,
  WorkoutActivityType: { traditionalStrengthTraining: 50, running: 37 },
}));
jest.mock('@/state/settings', () => ({ getSettings: () => mockSettings }));
jest.mock('@/db/client', () => ({ getDb: () => ({ getAllAsync: async () => [] }) }));
jest.mock('@/db/workouts', () => ({
  getWorkoutDetail: jest.fn(async (id: number) => ({
    id,
    healthSynced: false,
    startedAt: Date.UTC(2026, 9, 12, 17, 0),
    endedAt: Date.UTC(2026, 9, 12, 18, 0),
    durationSec: 3600,
  })),
  listUnsyncedWorkouts: jest.fn(async () => []),
  markWorkoutHealthSynced: jest.fn(async (id: number) => void mockMarked.push(`w${id}`)),
}));
jest.mock('@/db/runs', () => ({
  getRun: jest.fn(async (id: number) => ({
    id,
    source: id === 2 ? 'strava' : 'manual',
    healthSynced: false,
    startedAt: Date.UTC(2026, 9, 11, 12, 0),
    distanceM: 5000,
    movingTimeSec: 1500,
    elapsedTimeSec: 1560,
  })),
  markRunHealthSynced: jest.fn(async (id: number) => void mockMarked.push(`r${id}`)),
}));

beforeEach(() => {
  jest.resetModules();
  mockSave.mockClear();
  mockAuth.mockClear();
  mockMarked.length = 0;
  mockExpoGo = false;
  mockSettings = { healthSync: true, bodyWeightLbs: 176.37 };
});

function load() {
  return require('../health.ios') as typeof import('../health.ios');
}

it('never touches HealthKit in Expo Go', async () => {
  mockExpoGo = true;
  const health = load();
  expect(health.healthSupport()).toBe('expo-go');
  expect(await health.syncWorkoutToHealth(1)).toBe(false);
  expect(mockSave).not.toHaveBeenCalled();
});

it('saves a strength workout with an active-energy estimate', async () => {
  const health = load();
  expect(health.healthSupport()).toBe('available');
  expect(await health.syncWorkoutToHealth(7)).toBe(true);
  const [type, quantities, start, end, totals, metadata] = mockSave.mock.calls[0] as unknown as [number, { quantity: number; unit: string }[], Date, Date, { energyBurned: number }, Record<string, unknown>];
  expect(type).toBe(50);
  // 80 kg × 4 kcal/kg/h × 1 h
  expect(totals).toEqual({ energyBurned: 320 });
  expect(quantities[0]).toMatchObject({ quantity: 320, unit: 'kcal' });
  expect(end.getTime() - start.getTime()).toBe(3_600_000);
  expect(metadata).toMatchObject({ HKExternalUUID: 'ironlog-workout-7' });
  expect(mockMarked).toEqual(['w7']);
});

it('omits calories without a body weight', async () => {
  mockSettings = { healthSync: true, bodyWeightLbs: null };
  const health = load();
  await health.syncWorkoutToHealth(3);
  const call = mockSave.mock.calls[0] as unknown as [number, unknown[], Date, Date, unknown];
  expect(call[1]).toEqual([]);
  expect(call[4]).toBeUndefined();
});

it('saves manual runs with distance, and skips Strava runs', async () => {
  const health = load();
  expect(await health.syncRunToHealth(1)).toBe(true);
  const [type, quantities, , , totals] = mockSave.mock.calls[0] as unknown as [number, { quantityType: string; quantity: number }[], Date, Date, { distance: number; energyBurned: number }];
  expect(type).toBe(37);
  expect(quantities.map((q) => q.quantityType)).toEqual([
    'HKQuantityTypeIdentifierDistanceWalkingRunning',
    'HKQuantityTypeIdentifierActiveEnergyBurned',
  ]);
  expect(totals).toEqual({ distance: 5000, energyBurned: 400 });
  expect(await health.syncRunToHealth(2)).toBe(false);
  expect(mockSave).toHaveBeenCalledTimes(1);
});

it('does nothing when sync is turned off', async () => {
  mockSettings = { healthSync: false, bodyWeightLbs: 180 };
  const health = load();
  expect(await health.syncWorkoutToHealth(1)).toBe(false);
  expect(mockSave).not.toHaveBeenCalled();
});
