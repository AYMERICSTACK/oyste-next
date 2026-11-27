#!/bin/sh
set -eu

node --import tsx --test lib/suppliers/stockman/__tests__/maintenance.test.ts
node --import tsx scripts/test-stockman-maintenance-qa.cjs
npm run build
