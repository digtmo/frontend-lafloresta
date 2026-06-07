// ─── Usuario / Auth ────────────────────────────────────────────────────────────
export type UserRole = 'admin' | 'repartidor'

export interface AppUser {
  email: string
  nombre: string
  rol: UserRole
}

// ─── WooCommerce raw types ─────────────────────────────────────────────────────
export interface WooMetaData {
  id: number
  key: string
  value: string | number | boolean | object
}

export interface WooLineItem {
  id: number
  name: string
  product_id: number
  variation_id: number
  quantity: number
  subtotal: string
  total: string
  price: number
  image?: { src: string }
  meta_data: WooMetaData[]
}

export interface WooShippingLine {
  id: number
  method_title: string
  total: string
}

export interface WooBilling {
  first_name: string
  last_name: string
  email: string
  phone: string
  address_1: string
  city: string
}

export interface WooShipping {
  first_name: string
  last_name: string
  address_1: string
  address_2: string
  city: string
}

export interface WooOrder {
  id: number
  number: string
  status: string
  date_created: string
  date_paid: string | null
  payment_method_title: string
  total: string
  subtotal: string
  shipping_total: string
  billing: WooBilling
  shipping: WooShipping
  line_items: WooLineItem[]
  shipping_lines: WooShippingLine[]
  meta_data: WooMetaData[]
  customer_note: string
}

// ─── Pedido enriquecido ────────────────────────────────────────────────────────
export interface PedidoMeta {
  fechaEnvio: string
  horario: string
  telefonoDestinatario: string
  mensajePersonal: string
  observaciones: string
}

export interface Pedido {
  id: number
  number: string
  status: string
  dateCreated: string
  datePaid: string | null
  paymentMethod: string
  total: number
  subtotal: number
  shippingTotal: number
  billing: WooBilling
  shipping: WooShipping
  lineItems: WooLineItem[]
  shippingLines: WooShippingLine[]
  customerNote: string
  meta: PedidoMeta
  repartidorEmail?: string
  repartidorNombre?: string
  fotoEntregaUrl?: string
  whatsappEnvio?: WhatsappEnvio | null
}

// ─── Asignación ────────────────────────────────────────────────────────────────
export interface AsignacionPedido {
  pedidoId: number
  repartidorEmail: string
  repartidorNombre: string
  fotoEntregaUrl?: string
  asignadoEn: string
}

export interface TokenFormulario {
  token: string
  creadoEn: number
  expiraEn: number
  usado: boolean
}

// ─── Productos WooCommerce ─────────────────────────────────────────────────────
export interface WooProduct {
  id: number
  name: string
  price: string
  regular_price: string
  sale_price: string
  status: string
  images: { src: string; alt: string }[]
  variations: number[]
  type: 'simple' | 'variable'
}

export interface WooVariation {
  id: number
  price: string
  attributes: { name: string; option: string }[]
}

// ─── WhatsApp ──────────────────────────────────────────────────────────────────
export type WhatsappEstado = 'enviando' | 'enviado' | 'entregado' | 'leido' | 'error'

export interface WhatsappEnvio {
  messageId: string | null
  estado: WhatsappEstado
  errorCode: number | null
  errorMensaje: string | null
  fotoUrl: string | null
  enviadoEn: string
  actualizadoEn: string
  respuestaCliente: string | null
  respuestaRecibidaEn: string | null
}

// ─── Repartidor enriquecido ────────────────────────────────────────────────────
export interface RepartidorInfo {
  email: string
  nombre: string
  pedidosHoy: number
}
