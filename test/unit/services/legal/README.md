# Legal Service Tests

This directory contains unit tests for the Legal module service layer.

## Test Structure

### legalService.test.ts

Tests for the `fetchLegalCases` service function that handles API communication.

**Test Coverage:**

- API parameter handling
- URL construction
- Error handling
- Response processing
- Edge cases
- Concurrent requests

**Key Features Tested:**

- Default parameter handling
- Custom search and filter parameters
- Pagination parameters
- Sorting functionality
- Special character encoding
- Network error handling
- HTTP status code handling
- Malformed response handling
- Large dataset handling
- Concurrent request handling

## Running Tests

```bash
# Run all Legal service tests
npm test -- test/unit/services/legal

# Run specific test file
npm test -- test/unit/services/legal/legalService.test.ts

# Run with coverage
npm test -- test/unit/services/legal --coverage
```

## Mock Dependencies

The tests mock the following dependencies:

- `axios` - HTTP client for API calls

## Test Scenarios

### Parameter Handling

- Default parameters (page=1, limit=10, sortField=last_call, sortDirection=desc)
- Custom search terms with special characters
- Country and outcome filters
- Pagination with large numbers
- All supported sort fields and directions

### Error Scenarios

- Network errors
- 404 Not Found responses
- 500 Internal Server Error responses
- Malformed response data
- Empty response handling

### Edge Cases

- Zero and negative parameter values
- Large page numbers and limits
- Special characters in search terms
- Null/undefined responses
- Concurrent API requests

## API Endpoint

The service tests the `/api/legal-cases` endpoint with the following query parameters:

- `search` - Search term for debtor name/number
- `page` - Page number for pagination
- `limit` - Number of records per page
- `country` - Country filter
- `sortField` - Field to sort by
- `sortDirection` - Sort direction (asc/desc)

## Best Practices

- Tests use realistic mock data
- Error scenarios are thoroughly covered
- URL encoding is properly tested
- Concurrent request handling is verified
- Edge cases and boundary conditions are tested
- Mock cleanup is performed between tests
