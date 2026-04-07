#!/usr/bin/env node
/**
 * Script to inject `const { showToast } = useToast();` into all components
 * that imported useToast but didn't call the hook yet.
 */
import { readFileSync, writeFileSync } from 'fs';

const files = [
  'src/pages/finance/CashPage.tsx',
  'src/pages/finance/ChecksPage.tsx',
  'src/pages/finance/ContainersPage.tsx',
  'src/pages/finance/ExpensesPage.tsx',
  'src/pages/finance/SettlementPage.tsx',
  'src/pages/hr/Payroll.tsx',
  'src/pages/inventory/Inventory.tsx',
  'src/pages/market/DailyMovements.tsx',
  'src/pages/orders/OrdersList.tsx',
  'src/pages/POS/POSPage.tsx',
  'src/pages/settings/Currencies.tsx',
  'src/pages/shipments/Shipments.tsx',
  'src/pages/superadmin/TenantsList.tsx',
  'src/pages/suppliers/Customers.tsx',
  'src/pages/suppliers/Suppliers.tsx',
  'src/pages/suppliers/SupplierStatement.tsx',
];

for (const file of files) {
  try {
    let content = readFileSync(file, 'utf-8');
    
    // Skip if already has the hook call
    if (content.includes('const { showToast } = useToast()')) {
      console.log(`⏭ Already has hook: ${file}`);
      continue;
    }

    // Find first useState/useEffect/useSelector/useDispatch call INSIDE a function
    // Strategy: find the first `const [` or `const {` inside the file after a function declaration
    // and inject before it
    
    // Pattern: After the first "function" or "const X = () =>" opening brace or first useState call
    // We inject after the opening of the first function body that contains a return statement
    
    // Simpler: find first occurrence of "  const [" or "  const { data" and inject before it
    const hookPattern = /^(  const (?:\[|\{))/m;
    const match = hookPattern.exec(content);
    if (match) {
      const idx = content.indexOf(match[0]);
      content = content.slice(0, idx) + `  const { showToast } = useToast();\n` + content.slice(idx);
      writeFileSync(file, content);
      console.log(`✅ Injected hook: ${file}`);
    } else {
      // Try after first { in default export function
      const fnMatch = /export default function \w+\s*\(\)\s*\{/.exec(content);
      if (fnMatch) {
        const insertAt = content.indexOf(fnMatch[0]) + fnMatch[0].length;
        content = content.slice(0, insertAt) + `\n  const { showToast } = useToast();` + content.slice(insertAt);
        writeFileSync(file, content);
        console.log(`✅ Injected hook (fn pattern): ${file}`);
      } else {
        console.warn(`⚠ Could not inject for: ${file}`);
      }
    }
  } catch(e) {
    console.error(`❌ Error with ${file}:`, e.message);
  }
}
console.log('Done.');
