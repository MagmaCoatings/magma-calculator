import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

// Register font (optional - uses default Helvetica if not registered)
Font.register({
  family: 'Helvetica',
  src: 'https://fonts.cdnfonts.com/s/29136/Helvetica.woff'
})

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 30,
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#EA580C',
    marginBottom: 5,
  },
  tagline: {
    fontSize: 10,
    color: '#666',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#111',
  },
  reference: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#EA580C',
    marginBottom: 5,
  },
  date: {
    fontSize: 10,
    color: '#666',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingBottom: 5,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    width: 100,
    color: '#666',
  },
  value: {
    flex: 1,
    color: '#111',
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tableRowAlt: {
    flexDirection: 'row',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fafafa',
  },
  colProduct: {
    flex: 3,
  },
  colQty: {
    width: 50,
    textAlign: 'right',
  },
  colPrice: {
    width: 70,
    textAlign: 'right',
  },
  colTotal: {
    width: 70,
    textAlign: 'right',
  },
  headerText: {
    fontWeight: 'bold',
    color: '#333',
    fontSize: 9,
  },
  totalsSection: {
    marginTop: 20,
    alignItems: 'flex-end',
  },
  totalsRow: {
    flexDirection: 'row',
    width: 200,
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  totalsFinal: {
    flexDirection: 'row',
    width: 200,
    justifyContent: 'space-between',
    marginTop: 5,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#EA580C',
  },
  totalLabel: {
    color: '#666',
  },
  totalValue: {
    fontWeight: 'bold',
  },
  grandTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#EA580C',
  },
  notes: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
  },
  notesTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  notesText: {
    color: '#666',
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: '#999',
    fontSize: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
  smartCalcNote: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f3e8ff',
    borderRadius: 4,
  },
  smartCalcText: {
    fontSize: 8,
    color: '#7c3aed',
  },
})

interface QuoteItem {
  product_name: string
  product_code: string
  quantity: number
  unit_price: number
  line_total: number
  display_order: number
}

interface CompanyDetails {
  name?: string
  contactName?: string
  address?: string
  phone?: string
  mobile?: string
  email?: string
  website?: string
}

interface QuotePDFProps {
  reference: string
  clientName: string | null
  projectName: string | null
  surfaceType: string
  floorArea: number
  wallArea: number
  notes: string | null
  items: QuoteItem[]
  subtotal: number
  vat: number
  total: number
  createdAt: string
  company?: CompanyDetails
}

export function QuotePDF({
  reference,
  clientName,
  projectName,
  surfaceType,
  floorArea,
  wallArea,
  notes,
  items,
  subtotal,
  vat,
  total,
  createdAt,
  company,
}: QuotePDFProps) {
  const formatCurrency = (amount: number) => amount.toFixed(2)
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const getAreaDisplay = () => {
    if (surfaceType === 'floor') return `${floorArea}m²`
    if (surfaceType === 'wall') return `${wallArea}m²`
    return `${floorArea}m² floor + ${wallArea}m² wall`
  }

  const hasSmartCalc = items.some(item => item.product_name.includes('✦'))
  
  // Ensure items are sorted by display_order (stage order)
  const sortedItems = [...items].sort((a, b) => (a.display_order || 0) - (b.display_order || 0))

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }]}>
          <View>
            <Text style={styles.logo}>MAGMA COATINGS</Text>
            <Text style={styles.tagline}>Professional Microcement Solutions</Text>
          </View>
          {company && (company.name || company.email) ? (
            <View style={{ alignItems: 'flex-end', maxWidth: 240 }}>
              {company.name ? <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#111', textAlign: 'right' }}>{company.name}</Text> : null}
              {company.contactName ? <Text style={{ fontSize: 9, color: '#666', textAlign: 'right' }}>{company.contactName}</Text> : null}
              {company.address ? <Text style={{ fontSize: 8, color: '#666', textAlign: 'right' }}>{company.address}</Text> : null}
              {company.phone ? <Text style={{ fontSize: 8, color: '#666', textAlign: 'right' }}>Tel: {company.phone}</Text> : null}
              {company.mobile ? <Text style={{ fontSize: 8, color: '#666', textAlign: 'right' }}>Mob: {company.mobile}</Text> : null}
              {company.email ? <Text style={{ fontSize: 8, color: '#666', textAlign: 'right' }}>{company.email}</Text> : null}
              {company.website ? <Text style={{ fontSize: 8, color: '#666', textAlign: 'right' }}>{company.website}</Text> : null}
            </View>
          ) : null}
        </View>

        {/* Quote Info */}
        <Text style={styles.title}>Materials Estimate</Text>
        <Text style={styles.reference}>{reference}</Text>
        <Text style={styles.date}>{formatDate(createdAt)}</Text>

        {/* Client Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          {clientName ? (
            <View style={styles.row}>
              <Text style={styles.label}>Client:</Text>
              <Text style={styles.value}>{clientName}</Text>
            </View>
          ) : null}
          {projectName ? (
            <View style={styles.row}>
              <Text style={styles.label}>Project:</Text>
              <Text style={styles.value}>{projectName}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.label}>Surface:</Text>
            <Text style={styles.value}>{surfaceType.charAt(0).toUpperCase() + surfaceType.slice(1)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Area:</Text>
            <Text style={styles.value}>{getAreaDisplay()}</Text>
          </View>
        </View>

        {/* Materials Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Materials</Text>
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.colProduct, styles.headerText]}>Product</Text>
              <Text style={[styles.colQty, styles.headerText]}>Qty</Text>
              <Text style={[styles.colPrice, styles.headerText]}>Unit Price</Text>
              <Text style={[styles.colTotal, styles.headerText]}>Total</Text>
            </View>
            
            {/* Table Rows */}
            {sortedItems.map((item, index) => (
              <View key={index} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <View style={styles.colProduct}>
                  <Text>{item.product_name}</Text>
                  {item.product_code ? (
                    <Text style={{ color: '#999', fontSize: 8 }}>{item.product_code}</Text>
                  ) : null}
                </View>
                <Text style={styles.colQty}>{item.quantity}</Text>
                <Text style={styles.colPrice}>£{formatCurrency(item.unit_price)}</Text>
                <Text style={styles.colTotal}>£{formatCurrency(item.line_total)}</Text>
              </View>
            ))}
          </View>

          {/* Smart Calculation Note */}
          {hasSmartCalc && (
            <View style={styles.smartCalcNote}>
              <Text style={styles.smartCalcText}>
                ✦ Items marked with ✦ are calculated for the combined floor + wall area
              </Text>
            </View>
          )}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>£{formatCurrency(subtotal)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalLabel}>VAT (20%)</Text>
            <Text style={styles.totalValue}>£{formatCurrency(vat)}</Text>
          </View>
          <View style={styles.totalsFinal}>
            <Text style={styles.grandTotal}>Total</Text>
            <Text style={styles.grandTotal}>£{formatCurrency(total)}</Text>
          </View>
        </View>

        {/* Notes */}
        {notes ? (
          <View style={styles.notes}>
            <Text style={styles.notesTitle}>Notes</Text>
            <Text style={styles.notesText}>{notes}</Text>
          </View>
        ) : null}

        {/* Delivery Note */}
        <View style={{ marginTop: 15, padding: 10, backgroundColor: '#fef3c7', borderRadius: 4 }}>
          <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#92400e' }}>
            Pallet / Delivery Costs: TBC
          </Text>
          <Text style={{ fontSize: 8, color: '#b45309', marginTop: 2 }}>
            Quoted at time of order
          </Text>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Magma Coatings Ltd • Materials estimate valid for 30 days
        </Text>
      </Page>
    </Document>
  )
}
