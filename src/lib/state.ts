export type Category = { id: number; name: string }
export type Counter = { id: number; name: string; value: number; image?: string | null; maxValue?: number | null; categoryId: number }
export type Persisted = { categories: Category[]; counters: Counter[] }

export const STORAGE_KEY = 'counters_data'

export function loadState(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { categories: [], counters: [] }
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      const defaultCat: Category = { id: 1, name: '默认' }
      return { categories: [defaultCat], counters: parsed.map((c: any) => ({ ...(c as Counter), categoryId: defaultCat.id })) }
    }
    return parsed as Persisted
  } catch (e) {
    console.error(e)
    return { categories: [], counters: [] }
  }
}

export function saveState(state: Persisted) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.error('保存失败', e)
  }
}
