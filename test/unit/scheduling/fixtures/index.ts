// Re-export all fixtures for easy importing
export * from './collectionPeriods';
export * from './activities';
export * from './scheduling';
export * from './errors';
export * from './mocks';

// Legacy compatibility - re-export from the old file structure
// This allows existing tests to continue working while we migrate
export {
    MOCK_DATE,
    mockCollectionPeriod,
    mockPersonCollectionPeriod,
    mockActivitySequence,
    mockSMSActivitySequence,
    mockLastStepActivitySequence,
    mockScheduledDate,
    mockCreatedActivity,
    mockDeliveredActivity,
    mockActivityContact,
    mockBusinessHours,
    mockContactAvailability,
    mockSchedulingOptions,
    timezoneTestCases,
    dateFormattingTestCases,
    errorTestCases,
    performanceTestData,
    integrationTestData,
    mockFunctions,
    testConfig,
} from './schedulingTestData';
