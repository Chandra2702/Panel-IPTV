import { ref } from 'vue'

export async function apiCall(url: string, method: string = 'GET', body?: any) {
    const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
    }
    if (body && method !== 'GET') {
        options.body = JSON.stringify(body)
    }

    const res = await fetch(url, options)

    if (res.status === 401) {
        window.location.href = '/admin/login'
        throw new Error('Sesi berakhir, silakan login kembali')
    }

    const data = await res.json()
    if (!res.ok) {
        throw new Error(data.error || data.message || 'Terjadi kesalahan')
    }
    return data
}

export function useApi() {
    const loading = ref(false)
    const error = ref<string | null>(null)

    async function call(url: string, method: string = 'GET', body?: any) {
        loading.value = true
        error.value = null
        try {
            const data = await apiCall(url, method, body)
            return data
        } catch (err: any) {
            error.value = err.message
            throw err
        } finally {
            loading.value = false
        }
    }

    return { loading, error, call }
}

export function formatRupiah(num: number | string) {
    return 'Rp ' + Number(num || 0).toLocaleString('id-ID')
}

export async function checkAuth() {
    try {
        const data = await apiCall('/api/auth/me')
        return data
    } catch {
        window.location.href = '/admin/login'
        return null
    }
}

export async function logout() {
    try {
        await apiCall('/api/auth/logout', 'POST')
    } catch { }
    window.location.href = '/admin/login'
}
