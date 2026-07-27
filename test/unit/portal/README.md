# Portal Unit Tests

This directory contains unit tests for the portal functionality, which is a critical customer-facing feature that allows debtors to interact with their accounts.

## Test Structure

```
test/unit/portal/
├── README.md                           # This file
├── layout/                             # Portal layout tests
│   ├── subdomain-validation.test.ts    # Subdomain extraction and validation
│   ├── customer-lookup.test.ts         # Customer service integration
│   └── error-handling.test.ts          # Error scenarios and redirects
├── components/                         # Portal component tests
│   ├── PortalHome.test.ts              # Main portal home component
│   ├── PortalHeader.test.ts            # Header component
│   ├── PortalFooter.test.ts            # Footer component
│   └── PortalPageLayout.test.ts        # Page layout component
├── pages/                              # Portal page tests
│   ├── debtor-page.test.ts             # Main debtor page
│   └── sub-pages/                      # Sub-page functionality
│       ├── disputes.test.ts            # Dispute creation/viewing
│       ├── payments.test.ts            # Payment processing
│       ├── promise-to-pay.test.ts      # Promise-to-pay functionality
│       └── contact-reporting.test.ts   # Contact reporting
├── services/                           # Portal-specific services
│   ├── debtor-details.test.ts          # Debtor data fetching
│   └── customer-validation.test.ts     # Customer validation logic
├── api/                                # Portal API endpoint tests
│   ├── invoice-endpoints.test.ts       # Invoice API endpoints
│   └── portal-endpoints.test.ts        # Other portal endpoints
└── utils/                              # Portal utility functions
    ├── data-formatters.test.ts         # Data formatting utilities
    └── url-helpers.test.ts             # URL generation helpers
```

## Critical Test Scenarios

### 1. **Security & Authentication**

- Subdomain validation and customer isolation
- Authentication token validation
- Unauthorized access prevention
- Customer data isolation

### 2. **Business Logic**

- Promise-to-pay calculations and validation
- Invoice status determination (PAID/DUE)
- Outstanding debt calculations
- Dispute creation and management

### 3. **Data Integrity**

- Debtor information accuracy
- Invoice data consistency
- Collection period validation
- Currency and amount handling

### 4. **Error Handling**

- Database connection failures
- Invalid input validation
- Missing data scenarios
- Graceful degradation

## Automatic Test Execution

### 🚀 **Watch Mode (Recommended for Development)**

The portal tests automatically run in watch mode when you start them:

```bash
# Run all portal tests in watch mode
npm run test:portal:watch

# Or use the convenient script
npm run watch:portal
```

**What happens:**

- Tests run automatically when you save portal-related files
- Only affected tests re-run (fast feedback)
- Real-time test results in your terminal
- Press `q` to quit watch mode

### 📝 **Git Hooks (Automatic on Commit)**

Tests run automatically when you commit portal-related changes:

**Files that trigger portal tests:**

- `app/[locale]/portal/**/*.{ts,tsx}` → Runs all portal tests
- `pages/api/portal/**/*.ts` → Runs portal API tests
- `pages/api/invoices/portal.ts` → Runs portal API tests
- `server/services/**/*.ts` → Runs portal service tests

**What happens:**

- Tests run before commit is allowed
- Commit fails if tests fail
- Ensures code quality on every commit

### 🔧 **VS Code Integration**

Portal tests are integrated with VS Code:

**Features:**

- Test explorer shows all portal tests
- Click to run individual tests
- Debug tests directly in VS Code
- Test results in Problems panel
- Auto-run tests on file save (configurable)

**Setup:**

- Install Vitest extension for VS Code
- Tests automatically detected
- Use `Ctrl+Shift+P` → "Vitest: Run All Tests"

### 🚀 **CI/CD Pipeline (GitHub Actions)**

Portal tests run automatically in CI/CD:

**Triggers:**

- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Only when portal-related files change

**What happens:**

- Tests run on multiple Node.js versions
- Coverage reports generated
- Results posted to pull requests
- Prevents merging if tests fail

## Available Test Commands

### **All Portal Tests**

```bash
npm run test:portal              # Run once
npm run test:portal:watch        # Run in watch mode
npm run test:portal:ui           # Run with UI interface
npm run test:portal:coverage     # Run with coverage report
```

### **Specific Test Categories**

```bash
# API Endpoints
npm run test:portal:api          # Run once
npm run test:portal:api:watch    # Run in watch mode

# Services
npm run test:portal:services     # Run once
npm run test:portal:services:watch # Run in watch mode

# Layout & Components
npm run test:portal:layout       # Run once
npm run test:portal:layout:watch # Run in watch mode
```

### **Development Scripts**

```bash
npm run watch:portal             # Start portal test watcher
```

## Test Coverage

### **Current Coverage (49 tests)**

- ✅ **Subdomain Validation**: 17 tests
- ✅ **Debtor Details Service**: 19 tests
- ✅ **Invoice API Endpoints**: 13 tests

### **Coverage Areas**

- **Security**: Subdomain validation, authentication
- **Business Logic**: Promise-to-pay, invoice status, debt calculations
- **API Endpoints**: GET/POST requests, error handling
- **Data Validation**: Input validation, type checking
- **Error Scenarios**: Database errors, network failures

## Best Practices

### **Writing Tests**

1. **Test Business Logic First**: Focus on critical calculations and validations
2. **Mock External Dependencies**: Database, authentication, external APIs
3. **Test Error Scenarios**: Invalid inputs, network failures, missing data
4. **Use Descriptive Names**: Test names should explain what they're testing
5. **Keep Tests Fast**: Use efficient mocks and avoid real database calls

### **Running Tests**

1. **Use Watch Mode**: `npm run test:portal:watch` for development
2. **Run Specific Tests**: Use focused test commands for faster feedback
3. **Check Coverage**: `npm run test:portal:coverage` to see test coverage
4. **Fix Failing Tests**: Never commit with failing tests

### **Debugging Tests**

1. **Use VS Code Debugger**: Set breakpoints in test files
2. **Check Console Output**: Look for error messages and stack traces
3. **Verify Mocks**: Ensure mocks are set up correctly
4. **Isolate Issues**: Run individual test files to isolate problems

## Troubleshooting

### **Common Issues**

**Tests not running automatically:**

- Check if watch mode is active
- Verify file paths are correct
- Ensure VS Code Vitest extension is installed

**Mock errors:**

- Check mock setup in test files
- Verify import paths are correct
- Ensure mocks are reset between tests

**Authentication errors:**

- Check NextAuth mock setup
- Verify token structure matches expectations
- Ensure customer_id is properly mocked

### **Getting Help**

1. Check test output for error messages
2. Review mock setup in test files
3. Verify file paths and imports
4. Check package.json scripts are correct

## Future Enhancements

### **Planned Improvements**

- [ ] Component testing with React Testing Library
- [ ] E2E tests with Playwright
- [ ] Performance testing
- [ ] Accessibility testing
- [ ] Visual regression testing

### **Test Expansion**

- [ ] More API endpoint tests
- [ ] Component integration tests
- [ ] User interaction tests
- [ ] Mobile responsiveness tests

---

**Remember**: Portal tests are critical for customer-facing functionality. Always run tests before committing changes to ensure reliability and security.
