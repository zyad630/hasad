/**
 * Centralized Number Formatting Utility
 * Ensures consistent number display across the entire application.
 * Palestinian market standard: 3 decimal places for amounts, 6 for rates.
 */

export const formatAmount = (
  value: number | string | null | undefined,
  options?: {
    decimals?: number;
    locale?: string;
    currency?: string;
  }
): string => {
  if (value === null || value === undefined) return '0.000';
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.000';

  const decimals = options?.decimals ?? 3; // Palestinian standard: 3 decimals
  const locale = options?.locale ?? 'en-US'; // Use en-US for consistent dot separator

  return num.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const formatCurrency = (
  value: number | string | null | undefined,
  currencyCode: string = 'ILS',
  decimals: number = 3
): string => {
  const formatted = formatAmount(value, { decimals });
  const symbols: Record<string, string> = {
    ILS: '₪',
    USD: '$',
    JOD: 'JD',
    EUR: '€',
  };
  const symbol = symbols[currencyCode] || currencyCode;
  return `${formatted} ${symbol}`;
};

export const formatRate = (
  value: number | string | null | undefined,
  decimals: number = 6
): string => {
  return formatAmount(value, { decimals });
};

export const formatPercentage = (
  value: number | string | null | undefined,
  decimals: number = 2
): string => {
  if (value === null || value === undefined) return '0.00%';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.00%';
  return `${num.toFixed(decimals)}%`;
};

export const parseInputNumber = (value: string): number => {
  // Remove any commas (from locale formatting) and parse
  const cleaned = value.replace(/,/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

export const normalizeArabicNumerals = (text: string): string => {
  // Convert Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩) to Western Arabic numerals (0123456789)
  const arabicIndicMap: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  };
  return text.replace(/[٠-٩]/g, (char) => arabicIndicMap[char] || char);
};
