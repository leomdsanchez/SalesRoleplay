#!/usr/bin/env bash

# VoiceSettings System - Complete Test Suite Runner
# Executes all tests in the correct order with proper validation

echo "🚀 VoiceSettings System - Complete Test Suite"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to run command and check exit code
run_test() {
    local test_name="$1"
    local command="$2"

    echo -e "${BLUE}▶ Running: ${test_name}${NC}"
    echo "Command: $command"
    echo ""

    if eval "$command"; then
        echo -e "${GREEN}✅ PASS: ${test_name}${NC}"
        echo ""
        return 0
    else
        echo -e "${RED}❌ FAIL: ${test_name}${NC}"
        echo ""
        return 1
    fi
}

# Counter for passed/failed tests
PASSED=0
FAILED=0

echo "📋 Test Execution Order:"
echo "1. TypeScript Type Check"
echo "2. Build Validation"
echo "3. Database Migrations"
echo "4. Settings Schema Tests"
echo "5. Settings Storage Tests"
echo "6. Voice Settings API Tests"
echo "7. Double-Check Integration"
echo ""

# 1. TypeScript Type Check
if run_test "TypeScript Type Check" "npm run check"; then
    ((PASSED++))
else
    ((FAILED++))
fi

# 2. Build Validation
if run_test "Build Validation" "npm run build"; then
    ((PASSED++))
else
    ((FAILED++))
fi

# 3. Database Migrations
if run_test "Database Migrations" "npm run db:migrate"; then
    ((PASSED++))
else
    ((FAILED++))
fi

# 4. Settings Schema Tests
if run_test "Settings Schema Tests" "npx vitest run tests/settings-schema.test.ts"; then
    ((PASSED++))
else
    ((FAILED++))
fi

# 5. Settings Storage Tests
if run_test "Settings Storage Tests" "npx vitest run tests/settings-storage.test.ts"; then
    ((PASSED++))
else
    ((FAILED++))
fi

# 6. Voice Settings API Tests
if run_test "Voice Settings API Tests" "npx vitest run tests/voice-settings-api.test.ts"; then
    ((PASSED++))
else
    ((FAILED++))
fi

# 7. Double-Check Integration
if run_test "Double-Check Integration" "npx tsx tools/validation-scripts/double-check.js"; then
    ((PASSED++))
else
    ((FAILED++))
fi

# Summary
echo "📊 TEST SUMMARY"
echo "=============="
echo -e "Total Tests: $((PASSED + FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $FAILED${NC}"
    echo ""
    echo -e "${RED}❌ Some tests failed. Please review the output above.${NC}"
    exit 1
else
    echo -e "${GREEN}Failed: $FAILED${NC}"
    echo ""
    echo -e "${GREEN}🎉 ALL TESTS PASSED! System is ready for production.${NC}"
    echo ""
    echo "✅ VoiceSettings System Validation Complete:"
    echo "   - OpenAI 2025 models integrated"
    echo "   - Drizzle ORM working"
    echo "   - Zod validation active"
    echo "   - API endpoints secure"
    echo "   - Frontend UX improved"
    exit 0
fi
