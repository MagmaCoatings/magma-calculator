/**
 * Format currency with commas (e.g., £1,903.92)
 */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Format number with commas (e.g., 1,234)
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-GB')
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Format date and time for display
 */
export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
