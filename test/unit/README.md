# Unit Tests

This directory contains all unit tests for the Archaser application, organized by functionality and type.

## 📁 Directory Structure

```
test/unit/
├── 📁 services/           # Business logic services
│   ├── 📁 business/      # Core business services
│   │   ├── DisputeService.test.ts
│   │   └── CustomerService.test.ts
│   ├── 📁 import/        # Import/export services
│   │   ├── ImportService.test.ts
│   │   └── ImportJobService.test.ts
│   ├── 📁 activity/      # Activity-related services
│   │   ├── ActivityServiceLanguage.test.ts
│   │   └── ActivitySequenceValidation.test.ts
│   ├── 📁 auth/          # Authentication services
│   ├── 📁 user/          # User management services
│   ├── 📁 invoice/       # Invoice services
│   └── 📁 debtor/        # Debtor services
├── 📁 api/               # API endpoint tests
│   ├── 📁 business/      # Business logic endpoints
│   │   └── resolve-dispute.test.ts
│   ├── 📁 admin/         # Admin endpoints
│   │   └── account-creation.test.ts
│   ├── 📁 auth/          # Authentication endpoints
│   ├── 📁 debtor/        # Debtor endpoints
│   └── 📁 invoice/       # Invoice endpoints
├── 📁 components/        # React component tests
│   ├── 📁 business/      # Business-specific components
│   │   ├── UserDetails.test.tsx
│   │   └── UserList.test.tsx
│   ├── 📁 admin/         # Admin components
│   │   └── AccountUsers.test.tsx
│   ├── 📁 common/        # Shared components
│   ├── 📁 auth/          # Authentication components
│   └── 📁 data/          # Data display components
├── 📁 utils/             # Utility function tests
│   ├── 📁 validation/    # Validation utilities
│   │   └── email-validation.test.ts
│   ├── 📁 formatting/    # Formatting utilities
│   │   └── datetimeOperations.test.ts
│   ├── 📁 helpers/       # Helper functions
│   │   ├── logoUtils.test.ts
│   │   ├── cacheUtils.test.ts
│   │   └── helpers.test.ts
│   └── 📁 validation/    # Additional validation tests
├── 📁 integration/       # Integration tests
│   ├── account-creation-simple.test.ts
│   └── user-test-runner.ts
├── 📁 fixtures/          # Test data and fixtures
├── 📁 __mocks__/         # Mock files
└── 📄 README.md          # This file
```

## 🚀 Running Tests

### All Unit Tests

```bash
npm run test:unit
```

### Specific Categories

```bash
# Business services
npm run test:unit -- test/unit/services/business/

# API endpoints
npm run test:unit -- test/unit/api/

# Components
npm run test:unit -- test/unit/components/

# Utilities
npm run test:unit -- test/unit/utils/
```

### Specific Test Files

```bash
# Single test file
npm run test:unit -- test/unit/services/business/DisputeService.test.ts

# Multiple test files
npm run test:unit -- test/unit/services/business/ test/unit/api/business/
```

## 📋 Test Categories

### Services (`services/`)

- **Business Logic**: Core business services like Customer, Dispute
- **Import/Export**: Data import and export functionality
- **Activity**: Activity management and sequences
- **Authentication**: User authentication and authorization
- **User Management**: User-related operations
- **Invoice/Debtor**: Financial and debtor management

### API Endpoints (`api/`)

- **Business Logic**: Core business API endpoints
- **Admin**: Administrative API endpoints
- **Authentication**: Auth-related endpoints
- **Data Management**: CRUD operations

### Components (`components/`)

- **Business**: Business-specific UI components
- **Admin**: Administrative UI components
- **Common**: Shared/reusable components
- **Authentication**: Auth-related components

### Utilities (`utils/`)

- **Validation**: Input validation functions
- **Formatting**: Data formatting utilities
- **Helpers**: General helper functions

## 🎯 Best Practices

### Test Organization

- **Group by functionality**: Related tests in the same directory
- **Clear naming**: Descriptive test file names
- **Consistent structure**: Follow the template pattern

### Test Structure

- **Arrange-Act-Assert**: Clear test structure
- **Descriptive names**: Test names that explain behavior
- **Edge cases**: Test boundary conditions
- **Error conditions**: Test error handling

### Mocking Strategy

- **Mock dependencies**: Not the class under test
- **Real business logic**: Test actual functionality
- **Clear mocks**: Well-defined mock implementations

## 📚 Related Documentation

- [Unit Testing Guide](../../docs/unit-testing-guide.md)
- [Best Practices](../../docs/development-guides/unit-testing-best-practices.md)
- [Quick Reference](../../docs/development-guides/unit-testing-quick-reference.md)

## 🔧 Template Usage

Use the template files for new tests:

```bash
# Service test
cp ../../templates/service.test.ts.template services/business/NewService.test.ts

# API test
cp ../../templates/api.test.ts.template api/business/new-endpoint.test.ts

# Component test
cp ../../templates/component.test.tsx.template components/business/NewComponent.test.tsx

# Or use VS Code snippet: type 'unittest'
```

For detailed templates and usage instructions, see: [tests/templates/README.md](../../test/templates/README.md)

## 🚨 Critical Rules

1. **Don't mock the class you're testing**
2. **Test real business logic**
3. **Mock only dependencies**
4. **Follow the template structure**
5. **Use descriptive test names**

## 📈 Test Coverage

Monitor test coverage with:

```bash
npm run test:unit:coverage
```

This will show coverage for each category and help identify areas needing more tests.
