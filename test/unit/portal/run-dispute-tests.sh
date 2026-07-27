#!/bin/bash

# Dispute Tests Runner
# This script runs all the dispute-related unit tests

echo "🧪 Running Dispute Unit Tests..."
echo "=================================="

# Run API endpoint tests
echo "📡 Testing API Endpoints..."
npm run test test/unit/portal/api/check-available-invoices.test.ts

# Run component tests
echo "🧩 Testing Components..."
npm run test test/unit/portal/components/InvoiceSelector.test.tsx

# Run page logic tests
echo "📄 Testing Page Logic..."
npm run test test/unit/portal/pages/create-dispute-page.test.ts

echo ""
echo "✅ All dispute tests completed!"
echo ""
echo "📊 Test Summary:"
echo "- API Endpoint Tests: 1 file"
echo "- Component Tests: 1 file" 
echo "- Page Logic Tests: 1 file"
echo "- Total Test Files: 3"
echo ""
echo "🎯 Test Coverage:"
echo "- New API endpoint: check-available-invoices"
echo "- InvoiceSelector component functionality"
echo "- Dispute data fetching logic"
echo "- Error handling and edge cases"
echo "- Translation integration"
echo "- User interaction flows" 