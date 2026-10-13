import type { Profile } from '@/lib/types'
import { formatCurrency, vatLabel } from '@/lib/formatters'

export const ORDER_EMAIL_TO = 'sales@magmacoatings.com'

export interface OrderEmailLine {
  quantity: number
  name: string
  unitPrice: number
  total: number
}

export interface OrderEmailInput {
  reference: string | null // null for a quote that hasn't been saved
  clientName?: string | null
  projectName?: string | null
  surface: string // already human readable, e.g. "Floor + Wall"
  area: string // already human readable, e.g. "20m² floor + 10m² wall"
  colour?: string | null
  items: OrderEmailLine[]
  subtotal: number
  vat: number
  total: number
  vatRate: number
  profile: Profile | null
  userEmail?: string | null
}

/** Subject and body for the "place an order with Magma" email, shared by saved and unsaved quotes */
export function buildOrderEmail(q: OrderEmailInput): { subject: string; body: string } {
  const p = q.profile
  const senderName = [p?.first_name, p?.last_name].filter(Boolean).join(' ') || p?.full_name || ''
  const company = p?.company_name || ''

  const subject = [q.reference ? `Quote ${q.reference}` : 'Materials order', q.projectName, company]
    .filter(Boolean).join(' - ')

  const materialsList = q.items.map(item =>
    `${item.quantity} × ${item.name} @ £${formatCurrency(item.unitPrice)} each = £${formatCurrency(item.total)}`
  ).join('\n')

  const addressLine = [p?.address_line1, p?.address_line2, p?.address_line3, p?.town_city, p?.postcode]
    .filter(Boolean).join(', ')
  const details = [
    senderName,
    company,
    addressLine,
    p?.phone ? `Tel: ${p.phone}` : '',
    p?.mobile ? `Mobile: ${p.mobile}` : '',
    q.userEmail ? `Email: ${q.userEmail}` : '',
    p?.website_url ? `Web: ${p.website_url}` : '',
    p?.instagram_handle ? `Instagram: @${p.instagram_handle.replace(/^@/, '')}` : '',
    p?.facebook_url ? `Facebook: ${p.facebook_url}` : '',
  ].filter(Boolean)
  const signature = 'Thank you,\n\n' + details.join('\n')

  const header = q.reference ? `QUOTE REFERENCE: ${q.reference}\n` : ''
  const body = `Could I please place the order for the following materials:

${header}${q.clientName ? `\nClient: ${q.clientName}` : ''}
Surface: ${q.surface}
Area: ${q.area}${q.colour ? `\nColour: ${q.colour}` : ''}

MATERIALS
${materialsList}

TOTALS
Subtotal: £${formatCurrency(q.subtotal)}
${vatLabel(q.vatRate)}: £${formatCurrency(q.vat)}
Total: £${formatCurrency(q.total)}

PALLET / DELIVERY COSTS: TBC
(Quoted at time of order)

${signature}`

  return { subject, body }
}

/** Open the user's email app with the order email filled in */
export function openOrderEmail(q: OrderEmailInput) {
  const { subject, body } = buildOrderEmail(q)
  window.location.href = `mailto:${ORDER_EMAIL_TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
