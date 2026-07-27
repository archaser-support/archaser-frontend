# Scheduling Test Fixtures

This directory contains organized test fixtures for scheduling-related functionality. The fixtures are split into focused files for better maintainability and easier testing.

## 📁 File Structure

```
fixtures/
├── index.ts                    # Main export file for easy imports
├── collectionPeriods.ts        # Collection period test data and state transitions
├── activities.ts               # Activity sequences, templates, and status data
├── scheduling.ts               # Scheduling logic, timezones, and business hours
├── errors.ts                   # Error test cases and recovery scenarios
├── performance.ts              # Performance and load testing data
├── mocks.ts                    # Mock functions and external services
├── schedulingTestData.ts       # Legacy file (deprecated - use individual files)
└── README.md                   # This file
```

## 🎯 File Categories

### collectionPeriods.ts

- Collection period test data
- Person vs Company collection periods
- State transition test data
- Collection period lifecycle scenarios

### activities.ts

- Activity sequence test data
- Activity templates and content
- Activity status definitions
- Sequence boundary conditions

### scheduling.ts

- Scheduling calculation test data
- Timezone test cases
- Business hours configurations
- Date formatting test cases

### errors.ts

- Error test cases and codes
- Error recovery scenarios
- Validation error test data
- Exception handling patterns

### performance.ts

- Performance test configurations
- Load test scenarios
- Memory usage test data
- Database performance metrics

### mocks.ts

- Mock functions and services
- Prisma mock responses
- External service mocks
- Configuration mocks

## 🚀 Usage

### Import All Fixtures

```typescript
import {
    mockCollectionPeriod,
    mockActivitySequence,
    timezoneTestCases,
} from "./fixtures";
```

### Import Specific Categories

```typescript
import { mockCollectionPeriod } from "./fixtures/collectionPeriods";
import { mockActivitySequence } from "./fixtures/activities";
import { timezoneTestCases } from "./fixtures/scheduling";
```

### Legacy Compatibility

```typescript
// Old imports still work for backward compatibility
import { mockCollectionPeriod } from "./fixtures/schedulingTestData";
```

## 📝 Best Practices

### Adding New Fixtures

1. **Choose the right file** based on the fixture category
2. **Use descriptive names** that clearly indicate the fixture's purpose
3. **Include TypeScript types** for better type safety
4. **Add JSDoc comments** for complex fixtures
5. **Export from index.ts** for easy importing

### Fixture Naming Conventions

- `mock*` - Mock data objects
- `*TestCases` - Arrays of test case data
- `*TestData` - Complex test data objects
- `*Config` - Configuration objects
- `*Status` - Status constants and enums

### Example Fixture Structure

```typescript
// Good example
export const mockUserActivity = {
    id: 1,
    type: "Email",
    status: "Scheduled",
    // ... other properties
} as const;

// Good example - test cases
export const userActivityTestCases = [
    {
        name: "Valid email activity",
        input: { type: "Email", content: "Test content" },
        expected: { success: true },
    },
    // ... more test cases
];
```

## 🔧 Migration Guide

### From Old Structure

The old `schedulingTestData.ts` file is still available for backward compatibility, but new tests should use the organized structure:

```typescript
// Old way (still works)
import { mockCollectionPeriod } from "./fixtures/schedulingTestData";

// New way (recommended)
import { mockCollectionPeriod } from "./fixtures/collectionPeriods";
// or
import { mockCollectionPeriod } from "./fixtures";
```

### Benefits of New Structure

- **Better organization** - Related fixtures grouped together
- **Easier maintenance** - Smaller, focused files
- **Better imports** - Import only what you need
- **Type safety** - Better TypeScript support
- **Documentation** - Each file has a clear purpose

## 🚨 Important Notes

1. **Legacy file will be removed** in a future version
2. **Update imports** when convenient, but not required immediately
3. **New fixtures** should go in the appropriate category file
4. **Always export** new fixtures from `index.ts`
5. **Use TypeScript types** for better development experience
