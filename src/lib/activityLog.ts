import { supabase } from './supabase'

export type ActivityAction = 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'login' 
  | 'logout'
  | 'view'

export type EntityType = 
  | 'quote' 
  | 'system' 
  | 'product' 
  | 'user' 
  | 'settings'
  | 'stage'
  | 'colour'

interface LogActivityParams {
  action: ActivityAction
  entityType: EntityType
  entityId?: string
  entityName?: string
  details?: Record<string, unknown>
}

export async function logActivity({
  action,
  entityType,
  entityId,
  entityName,
  details
}: LogActivityParams): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      console.warn('logActivity called without authenticated user')
      return
    }

    const { error } = await supabase.from('activity_log').insert({
      user_id: user.id,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      entity_name: entityName || null,
      details: details || null
    })
    
    if (error) {
      console.error('Activity log insert failed:', error)
    }
  } catch (error) {
    // Don't throw - logging should never break the main flow
    console.error('Failed to log activity:', error)
  }
}

// Convenience functions
export const logCreate = (entityType: EntityType, entityId: string, entityName?: string, details?: Record<string, unknown>) =>
  logActivity({ action: 'create', entityType, entityId, entityName, details })

export const logUpdate = (entityType: EntityType, entityId: string, entityName?: string, details?: Record<string, unknown>) =>
  logActivity({ action: 'update', entityType, entityId, entityName, details })

export const logDelete = (entityType: EntityType, entityId: string, entityName?: string) =>
  logActivity({ action: 'delete', entityType, entityId, entityName })
