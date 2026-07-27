# Test Templates

This directory contains standardized test templates for creating new unit tests.

## 📋 Available Templates

### 1. Service Unit Test
**File**: `service.test.ts.template`

Use this template for testing business logic services.

**Usage:**
```bash
cp test/templates/service.test.ts.template test/unit/services/business/MyService.test.ts
```

**Features:**
- Uses Prisma mock factory
- Includes fixture imports
- Follows Arrange-Act-Assert pattern
- Includes success, error, and edge case examples

### 2. API Endpoint Test
**File**: `api.test.ts.template`

Use this template for testing API endpoints.

**Usage:**
```bash
cp test/templates/api.test.ts.template test/unit/api/business/my-endpoint.test.ts
```

**Features:**
- Uses NextAuth mock
- Includes Prisma mock factory
- Tests authentication and authorization
- Includes request/response examples

### 3. Component Test
**File**: `component.test.tsx.template`

Use this template for testing React components.

**Usage:**
```bash
cp test/templates/component.test.tsx.template test/unit/components/business/MyComponent.test.tsx
```

**Features:**
- Uses React Testing Library
- Includes translation mocks
- Tests rendering and interactions
- Includes error handling examples

## 🚀 Quick Start

1. **Copy the appropriate template**
   ```bash
   cp test/templates/service.test.ts.template test/unit/services/business/MyService.test.ts
   ```

2. **Replace placeholders**
   - `{ServiceName}` → Your actual service name
   - `{MethodName}` → Your actual method name
   - `{Brief description}` → Description of what you're testing

3. **Update imports**
   - Update import paths to match your project structure
   - Import fixtures from `@/test/fixtures/`
   - Import mocks from `@/test/mocks/`

4. **Add your test cases**
   - Follow the Arrange-Act-Assert pattern
   - Use fixtures for test data
   - Use mocks for dependencies

## 📚 Related Documentation

- [Unit Testing Guide](../../docs/unit-testing-guide.md)
- [Best Practices](../../docs/development-guides/unit-testing-best-practices.md)
- [Quick Reference](../../docs/development-guides/unit-testing-quick-reference.md)
- [Test Structure Plan](../../docs/development-guides/test-structure-improvement-plan.md)

## 🎯 Template Features

All templates include:
- ✅ Proper mock setup (dependencies, not the class under test)
- ✅ Fixture imports (ready to use)
- ✅ Arrange-Act-Assert structure
- ✅ Success, error, and edge case examples
- ✅ Documentation links
- ✅ Critical rules reminders

## 🚨 Critical Rules

1. **Don't mock the class you're testing** - Mock only dependencies
2. **Test real business logic** - Use real class instances
3. **Use fixtures** - Import test data from fixtures
4. **Use mocks** - Import mocks from mocks directory
5. **Follow patterns** - Use the template structure

