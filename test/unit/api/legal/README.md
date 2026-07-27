# Legal API Tests

This directory contains unit tests for the Legal module API endpoints.

## Test Structure

### legal-cases.test.ts

Tests for the `/api/legal-cases` API endpoint that handles legal cases data retrieval.

**Test Coverage:**

- GET request handling
- Query parameter processing
- Database query construction
- Response formatting
- Error handling
- HTTP method validation

**Key Features Tested:**

- Default query parameters
- Search functionality with multiple fields
- Country filtering
- Pagination logic
- Sorting by various fields
- Database error handling
- Invalid parameter handling
- Large dataset handling
- Special character handling

## Running Tests

```bash
# Run all Legal API tests
npm test -- test/unit/api/legal

# Run specific test file
npm test -- test/unit/api/legal/legal-cases.test.ts

# Run with coverage
npm test -- test/unit/api/legal --coverage
```

## Mock Dependencies

The tests mock the following dependencies:

- `@prisma/client` - Database ORM
- `shared/services/AccessControlService` - Authentication service
- `utils/serializeBigInt` - BigInt serialization utility

## API Endpoint

### GET /api/legal-cases

**Query Parameters:**

- `search` - Search term for debtor name, number, or company
- `page` - Page number (default: 1)
- `limit` - Records per page (default: 10)
- `country` - Country filter
- `sortField` - Field to sort by
- `sortDirection` - Sort direction (asc/desc)

**Response Format:**

```json
{
  "legalCases": [...],
  "totalRecords": 100,
  "currentPage": 1,
  "totalPages": 10,
  "hasNextPage": true,
  "hasPrevPage": false
}
```

## Test Scenarios

### Search Functionality

- Search by debtor first name
- Search by debtor last name
- Search by company name
- Search by debtor number
- Case-insensitive search
- Special character handling
- Multiple search terms

### Filtering

- Country-based filtering
- Current category filtering (Legal only)
- Active status filtering

### Pagination

- Default pagination (page 1, limit 10)
- Custom page and limit values
- Large page numbers
- Invalid pagination parameters

### Sorting

- Sort by debtor name
- Sort by debtor number
- Sort by amount overdue
- Sort by days past due
- Sort by country
- Sort by last call date
- Both ascending and descending orders

### Error Handling

- Database connection errors
- Invalid query parameters
- Unsupported HTTP methods
- Authentication errors

### Edge Cases

- Empty result sets
- Large datasets
- Null/undefined values
- Special characters in search terms
- Invalid sort fields

## Database Schema

The tests work with the following Prisma models:

- `DebtorCollectionPeriod` - Main legal cases table
- `Debtor` - Debtor information
- `Person` - Individual debtor details
- `Company` - Company debtor details
- `Country` - Country information

## Best Practices

- Tests use `node-mocks-http` for request/response mocking
- Database queries are properly mocked
- Authentication is verified for each request
- Error scenarios are thoroughly tested
- Response format validation is comprehensive
- Edge cases and boundary conditions are covered
- Mock cleanup is performed between tests
