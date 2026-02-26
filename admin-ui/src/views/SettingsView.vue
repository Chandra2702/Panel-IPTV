<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardTitle from '@/components/ui/CardTitle.vue'
import CardContent from '@/components/ui/CardContent.vue'
import { Settings, Save } from 'lucide-vue-next'
import { apiCall } from '@/composables/useApi'

const settings = ref<any>({})
const loading = ref(true)
const saving = ref(false)

onMounted(async () => {
  try {
    const data = await apiCall('/api/admin/settings')
    settings.value = data.settings || {}
  } catch (err: any) {
    console.error(err)
  } finally {
    loading.value = false
  }
})

async function saveSettings() {
  saving.value = true
  try {
    await apiCall('/api/admin/settings', 'PUT', settings.value)
    alert('Pengaturan berhasil disimpan!')
  } catch (err: any) {
    alert(err.message)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-bold tracking-tight">Pengaturan</h1>
      <p class="text-muted-foreground">Pengaturan sistem</p>
    </div>

    <div v-if="loading" class="text-center py-8 text-muted-foreground">Memuat...</div>

    <form v-else @submit.prevent="saveSettings" class="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Server API</CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <div>
            <label class="text-sm font-medium mb-1 block">Server URL</label>
            <input v-model="settings.server_url" class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" placeholder="http://your-server:port" />
          </div>
          <div>
            <label class="text-sm font-medium mb-1 block">API Key</label>
            <input v-model="settings.api_key" class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" placeholder="API Key" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Telegram Bot</CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <div>
            <label class="text-sm font-medium mb-1 block">Bot Token</label>
            <input v-model="settings.telegram_bot_token" class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" placeholder="123456:ABC-DEF..." />
          </div>
          <div>
            <label class="text-sm font-medium mb-1 block">Chat ID</label>
            <input v-model="settings.telegram_chat_id" class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" placeholder="-100..." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>QRIS Pembayaran</CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <div>
            <label class="text-sm font-medium mb-1 block">QRIS Raw Data</label>
            <textarea v-model="settings.qris_data" rows="3" class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" placeholder="Data QRIS mentah..."></textarea>
          </div>
          <div>
            <label class="text-sm font-medium mb-1 block">Nama Merchant</label>
            <input v-model="settings.merchant_name" class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" placeholder="Nama toko/merchant" />
          </div>
        </CardContent>
      </Card>

      <div class="flex justify-end">
        <button type="submit" :disabled="saving" class="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50">
          <Save :size="16" />
          {{ saving ? 'Menyimpan...' : 'Simpan Pengaturan' }}
        </button>
      </div>
    </form>
  </div>
</template>
