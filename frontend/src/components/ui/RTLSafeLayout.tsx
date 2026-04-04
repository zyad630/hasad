// src/components/ui/RTLSafeLayout.tsx
// Reference component — use this pattern everywhere in the app.
// All physical Tailwind classes (pl-, pr-, ml-, mr-) are replaced with
// logical equivalents (ps-, pe-, ms-, me-) for RTL safety.

import React from 'react';

interface PageLayoutProps { children: React.ReactNode; className?: string; }
interface FormFieldProps  { label: string; error?: string; children: React.ReactNode; required?: boolean; }
interface ColumnDef<T>    { key: keyof T; label: string; render?: (val: T[keyof T], row: T) => React.ReactNode; }
interface DataTableProps<T> { columns: ColumnDef<T>[]; data: T[]; emptyText?: string; }

/** Root page wrapper — always RTL, Cairo font */
export function PageLayout({ children, className = '' }: PageLayoutProps) {
  return (
    <div dir="rtl" className={`font-arabic min-h-screen bg-gray-50 ${className}`}>
      {children}
    </div>
  );
}

/** RTL-safe form field with label + error */
export function FormField({ label, error, children, required }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-semibold text-gray-700 text-right">
        {label}
        {required && <span className="text-red-500 ms-1">*</span>}
      </label>
      {children}
      {error && (
        <span className="text-xs text-red-600 text-right">{error}</span>
      )}
    </div>
  );
}

/** RTL-safe data table — first column on right, logical padding */
export function DataTable<T extends object>({ columns, data, emptyText = 'لا توجد بيانات' }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-100 shadow-sm" dir="rtl">
      <table className="w-full text-sm text-right">
        <thead className="bg-zinc-50">
          <tr>
            {columns.map(col => (
              <th
                key={String(col.key)}
                className="pe-4 ps-2 py-3 font-bold text-zinc-600 border-b border-zinc-200 first:pe-6"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="pe-4 py-10 text-center text-zinc-400 font-medium">
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr key={i} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                {columns.map(col => (
                  <td key={String(col.key)} className="pe-4 ps-2 py-3 text-zinc-800">
                    {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/** RTL-safe badge component */
export function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger' }) {
  const styles = {
    default:  'bg-zinc-100 text-zinc-700',
    success:  'bg-emerald-100 text-emerald-800',
    warning:  'bg-orange-100 text-orange-800',
    danger:   'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold ${styles[variant]}`}>
      {children}
    </span>
  );
}

/** RTL-safe stat card */
export function StatCard({ label, value, icon, trend }: { label: string; value: string | number; icon: string; trend?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5 flex items-center gap-4" dir="rtl">
      <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div className="flex-1 text-right">
        <p className="text-sm text-zinc-500 font-medium">{label}</p>
        <p className="text-2xl font-black text-zinc-900">{value}</p>
        {trend !== undefined && (
          <p className={`text-xs font-bold mt-0.5 ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </p>
        )}
      </div>
    </div>
  );
}
