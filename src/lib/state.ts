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
    // Avoid persisting large inline data URLs for images into localStorage.
    // Replace any image fields that are data URLs with null before saving.
    const safe: Persisted = {
      categories: state.categories,
      counters: (state.counters || []).map((c) => {
        const copy: Counter = { ...c }
        if (copy.image && typeof copy.image === 'string' && copy.image.startsWith('data:')) {
          copy.image = null
        }
        return copy
      })
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe))
  } catch (e) {
    console.error('保存失败', e)
  }
}
