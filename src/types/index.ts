export type Currency = 'RSD' | 'EUR'

export interface Member {
  id: string
  name: string
  color: string
  avatar_url: string | null
  sort_order: number
  created_at: string
}
export type TransactionType = 'prihod' | 'rashod'
export type RecurringType = 'fiksni' | 'varijabilni'
export type DebtDirection = 'dugujemo' | 'duguju_nam'
export type DebtStatus = 'aktivno' | 'izmireno'
export type CekStatus = 'na_cekanju' | 'isplacen' | 'propusten'
export type MonthStatus = 'otvoren' | 'zatvoren'

export interface Bucket {
  id: string
  name: string
  slug: string
  sort_order: number
  monthly_budget: number | null
  created_at: string
}

export interface Category {
  id: string
  bucket_id: string
  name: string
  type: TransactionType
  currency_default: Currency
  is_active: boolean
  created_at: string
  bucket?: Bucket
}

export interface RecurringItem {
  id: string
  bucket_id: string
  category_id: string
  name: string
  type: RecurringType
  amount: number | null
  currency: Currency
  due_day: number
  notify_7_days: boolean
  notify_3_days: boolean
  notify_on_day: boolean
  is_active: boolean
  created_at: string
  bucket?: Bucket
  category?: Category
}

export interface Transaction {
  id: string
  bucket_id: string
  category_id: string
  recurring_item_id: string | null
  user_id: string
  type: TransactionType
  amount: number
  currency: Currency
  date: string
  month: string
  note: string | null
  member_id: string | null
  created_at: string
  bucket?: Bucket
  category?: Category
  member?: Member
}

export interface Cek {
  id: string
  date: string
  quantity: number
  status: CekStatus
  month: string
  note: string | null
  cleared_at: string | null
  created_at: string
}

export interface Saving {
  id: string
  amount: number
  currency: Currency
  date: string
  note: string | null
  created_at: string
}

export interface SavingsGoal {
  id: string
  name: string
  target_amount: number
  currency: Currency
  deadline: string | null
  is_active: boolean
  created_at: string
}

export interface Debt {
  id: string
  direction: DebtDirection
  name: string
  bucket_id: string
  total_amount: number
  currency: Currency
  start_date: string
  note: string | null
  status: DebtStatus
  created_at: string
  bucket?: Bucket
  payments?: DebtPayment[]
  remaining?: number
}

export interface DebtPayment {
  id: string
  debt_id: string
  amount: number
  currency: Currency
  date: string
  note: string | null
  created_at: string
}

export interface Profile {
  id: string
  name: string
  created_at: string
}

export interface PushSubscription {
  id: string
  user_id: string
  subscription: PushSubscriptionJSON
  created_at: string
}

export interface NbsRate {
  id: string
  eur_to_rsd: number
  date: string
  fetched_at: string
}

export interface Month {
  id: string
  month: string
  status: MonthStatus
  carry_forward: number | null
  created_at: string
}

export interface MonthSummary {
  month: string
  total_prihodi: number
  total_rashodi: number
  balance: number
  carry_forward: number
  target_earnings: number
  unlogged_count: number
}
