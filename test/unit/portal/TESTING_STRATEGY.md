# Portal Testing Strategy

## Overview

The portal functionality is a critical customer-facing feature that requires comprehensive testing to ensure reliability, security, and user experience. This document outlines our testing approach for the portal components.

## Why Portal Testing is Critical

1. **Customer-Facing**: Direct interaction with debtors
2. **Security**: Subdomain validation and customer isolation
3. **Business Logic**: Complex calculations for payments, disputes, and promises
4. **User Experience**: Responsive design and accessibility
5. **Data Integrity**: Critical financial and personal information

## Testing Priorities

### 1. High Priority (Security & Core Functionality)

- **Subdomain validation** - Prevents unauthorized access
- **Customer lookup** - Ensures proper customer isolation
- **Debtor data fetching** - Core business logic
- **Error handling** - Graceful failure modes

### 2. Medium Priority (User Experience)

- **Component rendering** - Visual and functional correctness
- **Responsive design** - Mobile and tablet compatibility
- **Form validation** - User input validation
- **Navigation flows** - User journey completion

### 3. Low Priority (Enhancement)

- **Performance optimization** - Loading times and efficiency
- **Accessibility features** - WCAG compliance
- **Edge cases** - Unusual data scenarios

## Test Categories

### 1. Unit Tests

**Location**: `test/unit/portal/`

**Focus Areas**:

- Business logic functions
- Data transformation utilities
- Service layer methods
- Component rendering logic

**Examples**:

- Subdomain extraction and validation
- Debtor data processing
- Promise-to-pay calculations
- Currency formatting

### 2. Integration Tests

**Location**: `test/unit/portal/integration/`

**Focus Areas**:

- Component-service interactions
- Data flow between layers
- API endpoint integration
- Database operations

**Examples**:

- Portal layout with customer service
- Debtor page with data fetching
- Form submission workflows
- Error propagation

### 3. Component Tests

**Location**: `test/unit/portal/components/`

**Focus Areas**:

- React component behavior
- User interactions
- Props handling
- State management

**Examples**:

- PortalHome component rendering
- Action button functionality
- Modal interactions
- Form validation

## Test Data Strategy

### Mock Data Structure

```typescript
// Customer data
const mockCustomer = {
    id: 1,
    name: "Test Company",
    sub_domain: "testcompany",
    status: "Active" as const,
    promise_to_pay: 1,
    max_promise_to_pay_allowed_per_cycle: 3,
    logo: null,
    currency: "USD",
};

// Debtor data
const mockDebtor = {
    id: 1,
    debtor_uuid: "test-uuid-123",
    type: "Person" as const,
    Person: { full_name: "John Doe" },
    Company: null,
    Customer: mockCustomer,
    DebtorCollectionPeriod: [
        /* collection data */
    ],
};
```

### Test Scenarios

1. **Valid debtor with complete data**
2. **Debtor with missing optional fields**
3. **Company vs Person debtors**
4. **Debtors with disputes**
5. **Debtors with promise-to-pay history**
6. **Edge cases (zero amounts, negative amounts)**

## Mocking Strategy

### External Dependencies

```typescript
// Database
vi.mock("@/lib/prisma", () => ({
    prisma: {
        debtor: { findFirst: vi.fn() },
        customer: { findFirst: vi.fn() },
        debtorDispute: { count: vi.fn() },
    },
}));

// Next.js
vi.mock("next/headers", () => ({
    headers: vi.fn(() => new Map([["host", "testcompany.archaser.com"]])),
}));

// Services
vi.mock("@/server/services/CustomerService", () => ({
    CustomerService: {
        getCustomerBySubdomain: vi.fn(),
    },
}));
```

### Component Dependencies

```typescript
// Navigation
vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        back: vi.fn(),
    }),
}));

// Internationalization
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: "en" },
    }),
}));
```

## Testing Best Practices

### 1. Test Isolation

- Each test should be independent
- Clean up mocks between tests
- Use unique test data for each test

### 2. Descriptive Test Names

```typescript
it("should extract subdomain from valid hostname", () => {
    // test implementation
});

it("should handle missing customer gracefully", () => {
    // test implementation
});
```

### 3. Arrange-Act-Assert Pattern

```typescript
describe("Customer Lookup", () => {
    it("should find customer by subdomain", async () => {
        // Arrange
        const subdomain = "testcompany";
        const mockCustomer = {
            /* customer data */
        };
        mockGetCustomerBySubdomain.mockResolvedValue(mockCustomer);

        // Act
        const result = await CustomerService.getCustomerBySubdomain(subdomain);

        // Assert
        expect(result).toEqual(mockCustomer);
        expect(mockGetCustomerBySubdomain).toHaveBeenCalledWith(subdomain);
    });
});
```

### 4. Error Testing

```typescript
it("should handle database errors gracefully", async () => {
    const error = new Error("Database connection failed");
    mockPrisma.debtor.findFirst.mockRejectedValue(error);

    await expect(getDebtorDetails("test-uuid")).rejects.toThrow(
        "Database connection failed"
    );
});
```

## Running Tests

### Commands

```bash
# Run all portal tests
npm run test test/unit/portal/

# Run specific categories
npm run test test/unit/portal/layout/
npm run test test/unit/portal/components/
npm run test test/unit/portal/services/

# Run with coverage
npm run test:coverage test/unit/portal/
```

### Continuous Integration

- Tests run on every pull request
- Coverage reports generated
- Failed tests block deployment
- Performance benchmarks tracked

## Coverage Goals

### Minimum Coverage Targets

- **Business Logic**: 95%
- **Component Logic**: 90%
- **Error Handling**: 100%
- **Integration Points**: 85%

### Coverage Exclusions

- Third-party library code
- Generated code
- Configuration files
- Test utilities

## Performance Testing

### Metrics to Track

- Component render time
- Data fetching performance
- Memory usage
- Bundle size impact

### Tools

- React DevTools Profiler
- Lighthouse performance audits
- Bundle analyzer
- Memory leak detection

## Security Testing

### Areas to Test

- Subdomain validation
- Customer data isolation
- Input sanitization
- Authentication bypass attempts
- XSS prevention

### Tools

- OWASP ZAP
- ESLint security rules
- Dependency vulnerability scanning
- Penetration testing

## Accessibility Testing

### Standards

- WCAG 2.1 AA compliance
- Screen reader compatibility
- Keyboard navigation
- Color contrast requirements

### Tools

- axe-core
- Lighthouse accessibility audits
- Manual testing with screen readers
- Keyboard-only navigation testing

## Future Enhancements

### Planned Improvements

1. **Visual regression testing** - Screenshot comparison
2. **E2E testing** - Complete user journey testing
3. **Load testing** - Performance under stress
4. **Cross-browser testing** - Browser compatibility
5. **Mobile testing** - Device-specific testing

### Monitoring

- Real user monitoring (RUM)
- Error tracking and alerting
- Performance monitoring
- User behavior analytics

## Conclusion

Comprehensive portal testing is essential for maintaining a reliable, secure, and user-friendly customer experience. This strategy provides a structured approach to testing all aspects of the portal functionality while maintaining high code quality and user satisfaction.
