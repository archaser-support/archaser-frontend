# Legal Component Tests

This directory contains unit tests for the Legal module components.

## Test Structure

### LegalList.test.tsx

Tests for the main LegalList component that displays legal cases in a data grid.

**Test Coverage:**

- Component rendering and layout
- Data display and formatting
- Search functionality
- Filter controls
- Loading states
- Error handling
- Pagination
- Sorting
- Responsive design

**Key Features Tested:**

- Legal cases data grid display
- Search input functionality
- Filter controls (country, outcome)
- Priority chips and urgency colors
- Amount formatting
- Days past due display
- Last call result handling
- Null value handling

## Running Tests

```bash
# Run all Legal component tests
npm test -- test/unit/components/legal

# Run specific test file
npm test -- test/unit/components/legal/LegalList.test.tsx

# Run with coverage
npm test -- test/unit/components/legal --coverage
```

## Mock Dependencies

The tests mock the following dependencies:

- `next/navigation` - Router functionality
- `next-auth/react` - Authentication
- `react-i18next` - Internationalization
- `shared/redux/hooks` - Redux store
- `moment` - Date/time handling
- `shared/services/legalService` - API service layer

## Test Data

Mock data includes:

- Sample legal cases with various priorities
- Different debtor types (Person/Company)
- Various countries and amounts
- Null/undefined values for edge cases
- Different call results and statuses

## Best Practices

- Tests use `waitFor` for async operations
- Component rendering is isolated with proper providers
- Mock data is realistic and covers edge cases
- Error scenarios are thoroughly tested
- Accessibility and responsive design are verified
