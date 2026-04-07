#!/usr/bin/env node
/**
 * Script to replace all alert() with showToast() in all page files.
 * Run: node replace_alerts.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

// Get all tsx files with alert() in them
const files = [
  'src/pages/suppliers/SupplierStatement.tsx',
  'src/pages/suppliers/Suppliers.tsx',
  'src/pages/suppliers/Customers.tsx',
  'src/pages/superadmin/TenantsList.tsx',
  'src/pages/shipments/Shipments.tsx',
  'src/pages/settings/Currencies.tsx',
  'src/pages/POS/POSPage.tsx',
  'src/pages/orders/OrdersList.tsx',
  'src/pages/market/DailyMovements.tsx',
  'src/pages/inventory/Inventory.tsx',
  'src/pages/hr/Payroll.tsx',
  'src/pages/finance/SettlementPage.tsx',
  'src/pages/finance/ExpensesPage.tsx',
  'src/pages/finance/ContainersPage.tsx',
  'src/pages/finance/ChecksPage.tsx',
  'src/pages/finance/CashPage.tsx',
];

const importLine = `import { useToast } from '../../components/ui/Toast';`;
const importLineSupplier = `import { useToast } from '../../components/ui/Toast';`;

for (const file of files) {
  try {
    let content = readFileSync(file, 'utf-8');
    
    // Add import if not already present
    if (!content.includes('useToast')) {
      // Find the first import line and add after it
      content = content.replace(
        /^(import .+;\n)/m,
        `$1${importLine}\n`
      );
    }
    
    // Replace alert() patterns with showToast()
    content = content
      // success messages
      .replace(/alert\('تم (.+?)'\)/g, "showToast('تم $1', 'success')")
      .replace(/alert\("تم (.+?)"\)/g, 'showToast("تم $1", "success")')
      // warning/validation messages  
      .replace(/alert\('يجب (.+?)'\)/g, "showToast('يجب $1', 'warning')")
      .replace(/alert\('يرجى (.+?)'\)/g, "showToast('يرجى $1', 'warning')")
      // error messages
      .replace(/alert\('خطأ(.+?)'\)/g, "showToast('خطأ$1', 'error')")
      .replace(/alert\('حدث خطأ'\)/g, "showToast('حدث خطأ في العملية', 'error')")
      .replace(/alert\('حدث خطأ؟(.+?)'\)/g, "showToast('حدث خطأ$1', 'error')")
      .replace(/alert\(`خطأ: \$\{(.+?)\}`\)/g, "showToast(`خطأ: \${$1}`, 'error')")
      .replace(/alert\(`عذراً, فشل (.+?)\`\)/g, "showToast(`عذراً، فشل $1`, 'error')")
      // remaining alert → showToast info
      .replace(/\balert\(([^)]+)\)/g, "showToast($1, 'info')");

    writeFileSync(file, content);
    console.log(`✅ Patched: ${file}`);
  } catch(e) {
    console.error(`❌ Error with ${file}:`, e.message);
  }
}
console.log('Done.');
