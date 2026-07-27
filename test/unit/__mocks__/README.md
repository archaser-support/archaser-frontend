# Test Database Configuration

This directory contains utilities and mocks for ensuring tests run against the local test database instead of production.

## 🚨 Critical Security

**NEVER run tests against the production database!** Tests can modify, delete, or corrupt production data.

## Configuration Files

### `.env.test`

Contains the local database configuration:

```
DATABASE_URL="postgresql://postgres:123456@localhost:5432/archaser"
```

### `testDatabase.ts`

Provides a singleton test database utility that:

- Verifies the test environment is properly configured
- Ensures connection to local database only
- Provides cleanup utilities for test data
- Prevents accidental connection to production

## Usage

### In Test Files

```typescript
import { testDatabase } from "../../__mocks__/testDatabase";

const prisma = testDatabase.getPrisma();
```

### Running Tests Safely

```bash
# Use the safe test runner (recommended)
npm run test:unit:safe

# Or run directly with environment
NODE_ENV=test npm run test:unit
```

## Environment Verification

The test setup automatically verifies:

1. ✅ `NODE_ENV` is set to `test`
2. ✅ `DATABASE_URL` is configured
3. ✅ Database URL points to localhost (not production)
4. ✅ Local PostgreSQL is accessible

## Test Data Cleanup

The test database utility automatically cleans up:

- Invoices with test prefixes (`TEST_IMPORT_`, `TEST_CREDIT_`, `TEST_BATCH_`)
- Test debtors with IDs 999990-999996
- Test customers with IDs 999990-999996

## Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Check database exists
psql -h localhost -U postgres -d archaser -c "SELECT 1;"
```

### Environment Issues

```bash
# Verify .env.test exists and is readable
cat .env.test

# Check environment variables
echo $NODE_ENV
echo $DATABASE_URL
```

### Test Data Issues

If tests are failing due to existing data:

```bash
# Clean up manually (be careful!)
psql -h localhost -U postgres -d archaser -c "DELETE FROM invoices WHERE invoice_number LIKE 'TEST_%';"
```

## Best Practices

1. **Always use `npm run test:unit:safe`** for running tests
2. **Never modify `.env`** - only use `.env.test` for test configuration
3. **Use test prefixes** for all test data (e.g., `TEST_IMPORT_*`)
4. **Use high test IDs** (999990+) to avoid conflicts with real data
5. **Clean up after tests** - the utility handles this automatically

## Security Checklist

Before running tests, verify:

- [ ] `.env.test` exists and points to localhost
- [ ] No production database URLs in test environment
- [ ] PostgreSQL is running locally
- [ ] Test database is separate from production
- [ ] Using `npm run test:unit:safe` command
