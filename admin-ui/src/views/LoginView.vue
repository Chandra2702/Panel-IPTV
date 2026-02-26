<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiCall } from '@/composables/useApi'

const router = useRouter()
const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  loading.value = true
  error.value = ''
  try {
    await apiCall('/api/auth/login', 'POST', {
      username: username.value,
      password: password.value
    })
    router.push('/dashboard')
  } catch (err: any) {
    error.value = err.message || 'Login gagal'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background p-4">
    <div class="w-full max-w-md">
      <div class="bg-card border rounded-xl shadow-lg p-8">
        <div class="text-center mb-8">
          <div class="text-4xl mb-2">📺</div>
          <h1 class="text-2xl font-bold">IPTV Panel</h1>
          <p class="text-muted-foreground text-sm mt-1">Masuk ke panel admin</p>
        </div>

        <form @submit.prevent="handleLogin" class="space-y-4">
          <div v-if="error" class="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
            {{ error }}
          </div>

          <div>
            <label class="block text-sm font-medium mb-1.5">Username</label>
            <input
              v-model="username"
              type="text"
              required
              autofocus
              class="w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Masukkan username"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-1.5">Password</label>
            <input
              v-model="password"
              type="password"
              required
              class="w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Masukkan password"
            />
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <span v-if="loading">Memuat...</span>
            <span v-else>Masuk</span>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
