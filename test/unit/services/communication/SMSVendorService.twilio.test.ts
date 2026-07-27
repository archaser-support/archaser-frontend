import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { prisma } from '@/lib/prisma';
import { LogService } from '@/server/services/LogService';
import { SMSVendorService } from '@/server/services/SMSVendorService';

// Mocks
vi.mock('@/lib/prisma', async () => {
  const { createPrismaMock } = await import('@/test/mocks/prisma');
  const mockPrisma = createPrismaMock();
  return {
    prisma: {
      ...mockPrisma,
      countrySMSVendor: {
        findFirst: vi.fn(),
      },
      sMSVendor: {
        findFirst: vi.fn(),
      },
      accountSMSProviderPreferences: {
        findFirst: vi.fn(),
      },
      country: {
        findFirst: vi.fn(),
      },
      activity: {
        ...mockPrisma.activity,
        findUnique: vi.fn().mockResolvedValue({
          id: BigInt(1),
          customer_id: 1,
          schedule_time: new Date(),
          type: 'SMS',
        }),
      },
    },
  };
});

vi.mock('@/server/services/LogService', () => ({
  LogService: {
    getInstance: vi.fn(() => ({
      logMessage: vi.fn(),
    })),
  },
}));

// Mock learning service to avoid side-effects
vi.mock('@/server/services/CommunicationLearningService', () => ({
  CommunicationLearningService: vi.fn().mockImplementation(() => ({
    recordCommunicationOutcome: vi.fn(),
  })),
}));

// Mock twilio client - create mock function that will be shared
const createMessageMock = vi.fn().mockResolvedValue({ sid: 'SM1234567890' });

// Create a mock Twilio client factory for dependency injection
const createMockTwilioClientFactory = () => {
  return (accountSid: string, authToken: string) => {
    return {
      messages: {
        create: createMessageMock,
      },
    };
  };
};

describe('SMSVendorService - Twilio via country mapping', () => {
  let service: SMSVendorService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the createMessageMock for each test
    createMessageMock.mockClear();
    createMessageMock.mockResolvedValue({ sid: 'SM1234567890' });
    // Inject the mock Twilio client factory
    service = new SMSVendorService(createMockTwilioClientFactory());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses Twilio when country mapping points to a Twilio vendor', async () => {
    const countryId = 99;
    const activityId = 123;

    // Arrange: Prisma returns a country-specific mapping with provider twilio
    // This is called by getVendorForCountry with where: { country_id, is_active: true, SMSVendor: { is_active: true } }
    (prisma.countrySMSVendor.findFirst as any).mockImplementation((args: any) => {
      // Match the query from getVendorForCountry
      if (args?.where?.country_id === countryId && 
          args?.where?.is_active === true &&
          args?.where?.SMSVendor?.is_active === true) {
        return Promise.resolve({
          country_id: countryId,
          vendor_id: 10,
          cost_per_sms: 0.05,
          currency: 'USD',
          is_active: true,
          is_default: true,
          SMSVendor: {
            id: 10,
            name: 'Twilio Global',
            provider: 'twilio',
            account_sid: 'ACxxxx',
            auth_token: 'tok_xxxx',
            webhook_url: 'https://example.com/api/sms/webhook/twilio',
            is_active: true,
            priority: 1,
            cost_per_sms: 0.05,
            currency: 'USD',
            use_account_sender_name: true,
          },
        });
      }
      return Promise.resolve(null);
    });

    // Mock country lookup for mobile number detection (US number +15551230001)
    // This is called by detectCountryFromMobileNumber with where: { iso2: 'US' }, select: { id: true }
    (prisma.country.findFirst as any).mockImplementation((args: any) => {
      if (args?.where?.iso2 === 'US') {
        return Promise.resolve({ id: countryId });
      }
      return Promise.resolve(null);
    });

    // Mock account-specific country mapping (needed for sendSMS to not block SMS)
    // This is called by isSMSBlockedForCustomerCountry with include: { SMSVendor: true, Country: true }
    (prisma.accountSMSProviderPreferences.findFirst as any).mockResolvedValue({
      account_id: 1,
      country_id: countryId,
      vendor_id: 10,
      is_enabled: true,
      SMSVendor: {
        id: 10,
        is_active: true,
      },
      Country: {
        id: countryId,
        iso2: 'US',
      },
    });

    // Mock activity lookup (needed for sendSMS)
    (prisma.activity.findUnique as any).mockResolvedValue({
      id: BigInt(activityId),
      customer_id: 1,
      schedule_time: new Date(),
      type: 'SMS',
    });

    // Act
    const result = await service.sendSMS(
      '+15551230001',
      'ARchaser',
      'Hello from test',
      countryId,
      activityId,
      /* accountId */ 1
    );

    // Assert
    expect(result.success).toBe(true);
    expect(result.vendorId).toBe(10);
    expect(result.messageId).toBeDefined();
    expect(createMessageMock).toHaveBeenCalledWith({
      body: 'Hello from test',
      from: 'ARchaser',
      to: '+15551230001',
      statusCallback: 'https://example.com/api/sms/webhook/twilio',
    });
  });
});


