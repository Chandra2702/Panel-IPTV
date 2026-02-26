<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardTitle from '@/components/ui/CardTitle.vue'
import CardContent from '@/components/ui/CardContent.vue'
import { Activity, PlayCircle, Clock } from 'lucide-vue-next'
import { apiCall } from '@/composables/useApi'

const activeStreams = ref<any[]>([])
const activityLogs = ref<any[]>([])
const loading = ref(true)
const page = ref(1)
const totalPages = ref(1)
const limit = 10
let refreshInterval: any = null

onMounted(() => {
  loadData()
  refreshInterval = setInterval(loadData, 15000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})

async function loadData() {
  try {
    const [streamData, logData] = await Promise.all([
      apiCall('/api/admin/monitor/streams'),
      apiCall(`/api/admin/monitor/logs?page=${page.value}&limit=${limit}`)
    ])
    activeStreams.value = streamData.streams || []
    activityLogs.value = logData.logs || []
    totalPages.value = logData.pages || 1
  } catch (err: any) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

function changePage(newPage: number) {
  if (newPage < 1 || newPage > totalPages.value) return
  page.value = newPage
  loadData()
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'baru saja'
  if (mins < 60) return `${mins} menit lalu`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} jam lalu`
  return `${Math.floor(hours / 24)} hari lalu`
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-bold tracking-tight">Monitor Langsung</h1>
      <p class="text-muted-foreground">Stream aktif & aktivitas terbaru</p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <PlayCircle class="h-5 w-5 text-green-500" /> Stream Aktif
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div v-if="loading" class="text-center py-8 text-muted-foreground">Memuat...</div>
        <div v-else-if="activeStreams.length === 0" class="text-center py-8 text-muted-foreground">
          Tidak ada stream aktif
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b">
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">Pengguna</th>
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">Saluran</th>
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">IP</th>
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">Mulai</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in activeStreams" :key="s.id" class="border-b hover:bg-accent/50">
                <td class="py-3 px-2 font-medium">{{ s.username }}</td>
                <td class="py-3 px-2">{{ s.channel_name }}</td>
                <td class="py-3 px-2 text-muted-foreground">{{ s.ip_address }}</td>
                <td class="py-3 px-2 text-muted-foreground">{{ timeAgo(s.start_time) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <Clock class="h-5 w-5 text-blue-500" /> Log Aktivitas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div v-if="activityLogs.length === 0" class="text-center py-8 text-muted-foreground">
          Belum ada aktivitas
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b">
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">Aksi</th>
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">Pesan</th>
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">IP</th>
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">Waktu</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in activityLogs" :key="log.id" class="border-b hover:bg-accent/50">
                <td class="py-3 px-2">
                  <span class="px-2 py-0.5 bg-accent rounded text-xs font-medium">{{ log.action }}</span>
                </td>
                <td class="py-3 px-2">{{ log.message }}</td>
                <td class="py-3 px-2 text-muted-foreground">{{ log.ip }}</td>
                <td class="py-3 px-2 text-muted-foreground">{{ timeAgo(log.timestamp) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination Controls -->
        <div v-if="totalPages > 1" class="flex items-center justify-between border-t pt-4 mt-4">
          <div class="text-xs text-muted-foreground">
            Halaman {{ page }} dari {{ totalPages }}
          </div>
          <div class="flex gap-2">
            <button @click="changePage(page - 1)" :disabled="page === 1" 
              class="px-3 py-1 border rounded text-xs hover:bg-accent disabled:opacity-50">
              Prev
            </button>
            <button @click="changePage(page + 1)" :disabled="page === totalPages"
              class="px-3 py-1 border rounded text-xs hover:bg-accent disabled:opacity-50">
              Next
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
