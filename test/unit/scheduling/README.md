# Consolidated Scheduling Tests

This directory contains consolidated test files for all scheduling-related functionality in the Archaser application. The tests are organized into 6 main files to minimize test runs while maintaining comprehensive coverage.

## 📁 File Structure

```
test/unit/scheduling/
├── SchedulingCore.test.ts              # Core scheduling logic (datetime, timezone, business hours)
├── ActivityScheduling.test.ts          # Activity scheduling (ActivityService, templates, sequences)
├── SchedulingIntegration.test.ts       # Integration tests (workflows, cron jobs)
├── BusinessHoursEdgeCases.test.ts      # Business hours edge cases and complex scenarios
├── ActivitySequenceBoundaryConditions.test.ts # Activity sequence boundary conditions
├── CollectionPeriodStateTransitions.test.ts   # Collection period state transitions
├── BusinessLogicAnalysis.md            # Business logic analysis documentation
├── fixtures/
│   ├── index.ts                        # Main export file for easy imports
│   ├── collectionPeriods.ts            # Collection period test data
│   ├── activities.ts                   # Activity sequences and templates
│   ├── scheduling.ts                   # Scheduling logic and timezones
│   ├── errors.ts                       # Error test cases and recovery
│   ├── performance.ts                  # Performance and load testing
│   ├── mocks.ts                        # Mock functions and services
│   ├── schedulingTestData.ts           # Legacy file (deprecated)
│   └── README.md                       # Fixtures documentation
└── README.md                           # This file
```

## 🚀 Quick Start Commands

| Command                               | Duration | Description                        |
| ------------------------------------- | -------- | ---------------------------------- |
| `npm run test:scheduling:core`        | 30s      | Core scheduling logic tests        |
| `npm run test:scheduling:activity`    | 2-3m     | Activity scheduling tests          |
| `npm run test:scheduling:integration` | 5-10m    | Workflow integration tests         |
| `npm run test:scheduling:full`        | 3-5m     | Core + activity scheduling tests   |
| `npm run test:scheduling:edge-cases`  | 5-10m    | Edge cases and boundary conditions |
| `npm run test:scheduling:all`         | 10-15m   | All consolidated scheduling tests  |
| `npm run test:scheduling:watch`       | -        | Watch mode for development         |
| `npm run test:scheduling:coverage`    | -        | Generate coverage report           |
| `npm run test:scheduling:ui`          | -        | Open Vitest UI                     |

## 🎯 Test Categories

### Core Tests

- **SchedulingCore.test.ts** - `scheduleDateTime`, timezone handling, business hours
- **ActivityScheduling.test.ts** - `createAutomatedActivity`, templates, sequences

### Integration Tests

- **SchedulingIntegration.test.ts** - End-to-end workflows, cron jobs, performance

### Edge Case Tests

- **BusinessHoursEdgeCases.test.ts** - Holiday overlaps, vacation periods, emergency scheduling
- **ActivitySequenceBoundaryConditions.test.ts** - First/last steps, sequence validation
- **CollectionPeriodStateTransitions.test.ts** - State transitions (New → Automated → Agent → Closed)

## 🔧 Test Data

Test data is organized in focused fixture files:

```typescript
// Import everything
import { mockCollectionPeriod, timezoneTestCases } from "./fixtures";

// Import specific categories
import { mockCollectionPeriod } from "./fixtures/collectionPeriods";
import { timezoneTestCases } from "./fixtures/scheduling";
```

**Core Fixtures:**

- `collectionPeriods.ts` - Collection period data and state transitions
- `activities.ts` - Activity sequences, templates, and status data
- `scheduling.ts` - Scheduling logic, timezones, and business hours

**Specialized Fixtures:**

- `errors.ts` - Error test cases and recovery scenarios
- `performance.ts` - Performance and load testing data
- `mocks.ts` - Mock functions and external services

## 📝 Development Workflow

### When to Run Which Tests

| Change Type                                       | Command                               | Files   |
| ------------------------------------------------- | ------------------------------------- | ------- |
| Core changes (datetime, timezone, business hours) | `npm run test:scheduling:core`        | 1 file  |
| Activity changes (ActivityService, templates)     | `npm run test:scheduling:full`        | 2 files |
| Workflow changes (cron jobs, integration)         | `npm run test:scheduling:integration` | 1 file  |
| Edge cases and boundary conditions                | `npm run test:scheduling:edge-cases`  | 3 files |
| Complete validation                               | `npm run test:scheduling:all`         | 6 files |

### Adding New Tests

1. **Identify the appropriate file** based on functionality
2. **Use shared test data** from fixtures
3. **Follow existing patterns** for consistency
4. **Update this README** if adding new test categories

## 🚨 Critical Rules

1. **Always use shared test data** from fixtures
2. **Mock external dependencies** properly
3. **Test both success and error cases**
4. **Maintain test isolation** (clean mocks between tests)
5. **Use descriptive test names** that explain the behavior

## 📈 Benefits

- **Minimal Test Runs** - Run only relevant tests (30s to 15m)
- **Comprehensive Coverage** - All scheduling functionality covered
- **Easy Maintenance** - Related tests grouped together with centralized test data
- **Clear Documentation** - Guidelines and examples for consistent testing

## 🔗 Related Files

- `utils/datetimeOperations.ts` - Core scheduling logic
- `utils/businessHoursService.ts` - Business hours logic
- `server/services/ActivityService.ts` - Activity scheduling
- `server/cron-jobs/processAutomatedCollectionPeriods.ts` - Collection processing
- `server/cron-jobs/activityWorkflowManager.ts` - Activity workflow
