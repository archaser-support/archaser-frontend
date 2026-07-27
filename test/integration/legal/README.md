# Legal Integration Tests

This directory contains integration tests for the Legal module that test the complete flow from UI to API.

## Test Structure

### LegalIntegration.test.ts

End-to-end integration tests for the Legal cases functionality.

**Test Coverage:**

- Complete user workflows
- API integration
- Data transformation
- Error handling
- Performance testing
- Real-world scenarios

**Key Features Tested:**

- Full legal cases loading flow
- Search functionality with API integration
- Pagination with API integration
- Sorting with API integration
- Error handling across the stack
- Large dataset performance
- Concurrent request handling
- Network error scenarios
- Data transformation accuracy

## Running Tests

```bash
# Run all Legal integration tests
npm test -- test/integration/legal

# Run specific test file
npm test -- test/integration/legal/LegalIntegration.test.ts

# Run with coverage
npm test -- test/integration/legal --coverage
```

## Mock Dependencies

The tests mock the following dependencies:

- `axios` - HTTP client for API calls
- `next/navigation` - Router functionality
- `next-auth/react` - Authentication
- `react-i18next` - Internationalization
- `shared/redux/hooks` - Redux store
- `moment` - Date/time handling

## Test Scenarios

### End-to-End Workflows

- **Legal Cases Loading**: Complete flow from component mount to data display
- **Search Integration**: User search input → API call → filtered results display
- **Pagination Integration**: Page navigation → API call → new data display
- **Sorting Integration**: Column sorting → API call → sorted data display

### API Integration

- **Successful API Calls**: Verify correct API endpoints and parameters
- **Error Handling**: Network errors, server errors, authentication errors
- **Response Processing**: Data transformation and display
- **Concurrent Requests**: Multiple simultaneous API calls

### Performance Testing

- **Large Datasets**: Handling 100+ records efficiently
- **Concurrent Operations**: Multiple user actions simultaneously
- **Memory Usage**: No memory leaks with large datasets
- **Response Times**: Acceptable performance with realistic data

### Error Scenarios

- **Network Errors**: Connection failures, timeouts
- **Server Errors**: 500, 401, 403 status codes
- **Data Errors**: Malformed responses, null values
- **Authentication Errors**: Unauthorized access attempts

### Data Transformation

- **API to UI Mapping**: Correct data display from API response
- **Null Value Handling**: Graceful handling of missing data
- **Formatting**: Currency, dates, and text formatting
- **Localization**: Proper translation and formatting

## Test Data

### Mock API Responses

- **Standard Response**: Typical legal cases with all fields populated
- **Empty Response**: No data scenarios
- **Large Response**: 100+ records for performance testing
- **Error Responses**: Various error scenarios
- **Partial Data**: Records with null/undefined values

### User Interactions

- **Search Input**: Typing, clearing, special characters
- **Filter Selection**: Country and outcome filters
- **Pagination**: Next/previous page navigation
- **Sorting**: Column header clicks

## Integration Points

### Component → Service → API

1. **Component**: User interaction triggers service call
2. **Service**: Constructs API request with parameters
3. **API**: Processes request and returns response
4. **Service**: Transforms API response
5. **Component**: Updates UI with transformed data

### Error Propagation

1. **API Error**: Server returns error response
2. **Service Error**: Service throws error
3. **Component Error**: Component displays error state
4. **User Feedback**: User sees appropriate error message

## Best Practices

- **Realistic Data**: Mock data matches real API responses
- **Complete Workflows**: Test entire user journeys
- **Error Scenarios**: Cover all possible error conditions
- **Performance**: Test with realistic data volumes
- **Isolation**: Each test is independent and isolated
- **Cleanup**: Proper cleanup between tests
- **Async Handling**: Proper async/await patterns
- **User Experience**: Verify user-facing functionality works correctly

## Test Categories

### Functional Integration

- Data loading and display
- Search and filtering
- Pagination and sorting
- Error handling and recovery

### Performance Integration

- Large dataset handling
- Concurrent operations
- Memory usage optimization
- Response time validation

### User Experience Integration

- Loading states
- Error states
- Success feedback
- Accessibility compliance
