#!/bin/sh
set -eu

node --import tsx scripts/verify-stockman-qa.mts
node scripts/test-stockman-qa-neon.cjs
node --import tsx --test \
  lib/suppliers/stockman/__tests__/page-structure.test.ts \
  lib/suppliers/stockman/__tests__/scan-completeness.test.ts \
  lib/suppliers/stockman/__tests__/prepare-import-policy.test.ts \
  lib/suppliers/stockman/__tests__/scheduled-commercial-sync.test.ts
npm run build
