<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardTitle from '@/components/ui/CardTitle.vue'
import CardContent from '@/components/ui/CardContent.vue'
import { Save, RadioReceiver, ExternalLink, ShieldCheck } from 'lucide-vue-next'
import { apiCall } from '@/composables/useApi'

const settings = ref<any>({})
const streamsArray = ref<any[]>([])
const loading = ref(true)
const saving = ref(false)

onMounted(async () => {
  try {
    // Fetch Title
    const data = await apiCall('/api/admin/settings')
    settings.value = data.settings || {}
    
    // Fetch Active Live Streams from Public API (Powered by Channels Table)
    const liveReq = await fetch('/api/public/live-url')
    if (liveReq.ok) {
        const liveData = await liveReq.json()
        streamsArray.value = liveData.streams || []
    }
  } catch (err: any) {
    console.error(err)
  } finally {
    loading.value = false
  }
})

async function saveSettings() {
  saving.value = true
  try {
    const payload = {
        live_stream_title: settings.value.live_stream_title
    }
    await apiCall('/api/admin/settings', 'PUT', payload)
    alert('Judul tayangan utama berhasil disimpan!')
  } catch (err: any) {
    alert(err.message)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold tracking-tight">Live Streaming</h1>
        <p class="text-muted-foreground">Kelola tayangan tunggal Server Live Stream pada Panel.</p>
      </div>
      <router-link to="/channels" class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
        <ExternalLink :size="16" /> Kelola Saluran / Tayangan
      </router-link>
    </div>

    <div v-if="loading" class="text-center py-8 text-muted-foreground">Memuat...</div>

    <form v-else @submit.prevent="saveSettings" class="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <RadioReceiver :size="18" /> Konfigurasi Player Utama
          </CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <div>
            <label class="text-sm font-medium mb-1 block">Judul Live Stream Utama</label>
            <input v-model="settings.live_stream_title" class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" placeholder="Masukkan Judul Live Terbesar" />
            <p class="text-xs text-muted-foreground mt-1">Judul halaman (Webpage Header) yang muncul paling atas pada pemutar <a href="/live" target="_blank" class="text-primary hover:underline">/live</a>.</p>
          </div>
          
          <div class="flex justify-end pt-2">
            <button type="submit" :disabled="saving" class="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 text-sm shadow-sm transition-all">
              <Save :size="16" />
              {{ saving ? 'Menyimpan...' : 'Simpan Judul' }}
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pratinjau Multi-Server (Live Stream Publik)</CardTitle>
          <p class="text-sm text-muted-foreground pt-1">Hanya tayangan dari menu Saluran dengan label <strong class="badge bg-green-100 text-green-700 px-1 py-0.5 rounded text-xs">Jadikan Server Live Stream</strong> yang akan muncul di daftar ini.</p>
        </CardHeader>
        <CardContent class="p-4">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b">
                  <th class="text-left py-3 px-2 font-medium text-muted-foreground w-12">No</th>
                  <th class="text-left py-3 px-2 font-medium text-muted-foreground">Judul Tayangan</th>
                  <th class="text-left py-3 px-2 font-medium text-muted-foreground">Metadata M3U / DRM</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="streamsArray.length === 0">
                    <td colspan="3" class="text-center py-10 text-muted-foreground">
                        Belum ada Server Live Stream Publik.<br/><br/>
                        Silakan ke menu <strong>Saluran</strong> lalu centang <em>"Jadikan Server Live Stream Publik"</em> saat tambah tayangan baru.
                    </td>
                </tr>
                <tr v-for="(stream, i) in streamsArray" :key="i" class="border-b hover:bg-accent/50 transition-colors bg-card">
                  <td class="py-3 px-2 text-muted-foreground font-mono">{{ i + 1 }}</td>
                  <td class="py-3 px-2 font-medium text-primary">
                      {{ stream.title }}
                  </td>
                  <td class="py-3 px-2">
                     <div class="space-y-1">
                        <div class="text-xs text-muted-foreground font-mono break-all line-clamp-1 truncate block w-[500px]" :title="stream.url">🔗 {{ stream.url }}</div>
                        <div class="flex items-center gap-2 text-[0.7rem] pt-1">
                            <span v-if="stream.userAgent" class="px-1.5 py-0.5 bg-accent text-accent-foreground rounded border border-border" title="User-Agent">🌐 UA</span>
                            <span v-if="stream.referrer" class="px-1.5 py-0.5 bg-accent text-accent-foreground rounded border border-border" title="Referrer">↪️ REF</span>
                            <span v-if="stream.drm" class="px-1.5 py-0.5 bg-green-100 text-green-800 rounded flex items-center gap-1 border border-green-200">
                                <ShieldCheck :size="10" /> DRM: {{ stream.drm.type }} ({{ stream.drm.keyId ? '✅ Keys Set' : '❌ No Keys'}})
                            </span>
                        </div>
                     </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

    </form>
  </div>
</template>
