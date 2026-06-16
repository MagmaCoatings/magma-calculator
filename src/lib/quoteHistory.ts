import { supabase } from './supabase'

interface HistoryDetails {
  [key: string]: string | number | boolean | null | undefined
}

export async function logQuoteHistory(
  quoteId: string,
  action: 'created' | 'updated' | 'status_changed' | 'item_added' | 'item_removed' | 'item_updated' | 'duplicated',
  options?: {
    fieldName?: string
    oldValue?: string | null
    newValue?: string | null
    details?: HistoryDetails
  }
) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    const { error } = await supabase
      .from('quote_history')
      .insert({
        quote_id: quoteId,
        user_id: user?.id || null,
        action,
        field_name: options?.fieldName || null,
        old_value: options?.oldValue || null,
        new_value: options?.newValue || null,
        details: options?.details || null,
      })

    if (error) {
      console.error('Quote history insert failed:', error)
    }
  } catch (err) {
    console.error('Quote history error:', err)
  }
}

// Convenience functions
export function logQuoteCreated(quoteId: string, reference: string) {
  return logQuoteHistory(quoteId, 'created', {
    details: { reference }
  })
}

export function logQuoteStatusChange(quoteId: string, oldStatus: string, newStatus: string) {
  return logQuoteHistory(quoteId, 'status_changed', {
    fieldName: 'status',
    oldValue: oldStatus,
    newValue: newStatus
  })
}

export function logQuoteUpdated(quoteId: string, fieldName: string, oldValue: string | null, newValue: string | null) {
  return logQuoteHistory(quoteId, 'updated', {
    fieldName,
    oldValue,
    newValue
  })
}

export function logQuoteItemAdded(quoteId: string, productName: string, quantity: number) {
  return logQuoteHistory(quoteId, 'item_added', {
    details: { productName, quantity }
  })
}

export function logQuoteItemRemoved(quoteId: string, productName: string) {
  return logQuoteHistory(quoteId, 'item_removed', {
    details: { productName }
  })
}

export function logQuoteItemUpdated(quoteId: string, productName: string, oldQty: number, newQty: number) {
  return logQuoteHistory(quoteId, 'item_updated', {
    fieldName: 'quantity',
    oldValue: String(oldQty),
    newValue: String(newQty),
    details: { productName }
  })
}

export function logQuoteDuplicated(quoteId: string, sourceReference: string, newReference: string) {
  return logQuoteHistory(quoteId, 'duplicated', {
    details: { sourceReference, newReference }
  })
}
