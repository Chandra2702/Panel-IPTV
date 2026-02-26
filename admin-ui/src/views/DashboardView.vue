<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardTitle from '@/components/ui/CardTitle.vue'
import CardContent from '@/components/ui/CardContent.vue'
import { Users, UserCheck, List, Layers, Activity, Coins, TrendingUp, DollarSign, History } from 'lucide-vue-next'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartData,
  type ChartOptions
} from 'chart.js'
import { apiCall, formatRupiah } from '@/composables/useApi'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const role = ref('admin')
const stats = ref<any>({})
const activities = ref<any[]>([])
const tokenLogs = ref<any[]>([])
const adminName = ref('Admin')
const chartData = ref<ChartData<'line'>>({
  labels: [],
  datasets: []
})

const chartOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
  },
  scales: {
    y: { beginAtZero: true }
  }
}))

onMounted(async () => {
  try {
    const data = await apiCall('/api/admin/dashboard')
    role.value = data.role || 'admin'
    adminName.value = data.admin?.username || 'Admin'
    stats.value = data.stats || {}

    if (data.recentLogs) {
      activities.value = data.recentLogs
    }
    if (data.tokenLogs) {
      tokenLogs.value = data.tokenLogs
    }

    if (data.chart && data.chart.labels?.length > 0) {
      chartData.value = {
        labels: data.chart.labels,
        datasets: [{
          label: 'Pengguna Baru',
          data: data.chart.data,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          tension: 0.4,
          fill: true
        }]
      }
    }
  } catch (err) {
    console.error('Dashboard load error:', err)
  }
})

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} menit lalu`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} jam lalu`
  return `${Math.floor(hours / 24)} hari lalu`
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-bold tracking-tight">Beranda</h1>
      <p class="text-muted-foreground">Selamat datang, {{ adminName }}</p>
    </div>

    <!-- Reseller Dashboard Cards -->
    <div v-if="role === 'reseller'" class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">Total Pengguna</CardTitle>
          <Users class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ stats.totalUsers || 0 }}</div>
          <p class="text-xs text-muted-foreground mt-1">{{ stats.activeUsers || 0 }} aktif</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">Paket Saya</CardTitle>
          <Layers class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ stats.totalBouquets || 0 }}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">Total Penjualan</CardTitle>
          <DollarSign class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ formatRupiah(stats.totalRevenue || 0) }}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">Sisa Token</CardTitle>
          <Coins class="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold text-amber-600">{{ stats.credits || 0 }}</div>
        </CardContent>
      </Card>
    </div>

    <!-- Admin Dashboard Cards -->
    <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">Total Pengguna</CardTitle>
          <Users class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ stats.totalUsers || 0 }}</div>
          <p class="text-xs text-muted-foreground mt-1">{{ stats.activeUsers || 0 }} aktif</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">Total Saluran</CardTitle>
          <List class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ stats.totalChannels || 0 }}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">Reseller</CardTitle>
          <UserCheck class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ stats.totalResellers || 0 }}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">Stream Aktif</CardTitle>
          <Activity class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ stats.activeStreams || 0 }}</div>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Pertumbuhan Pengguna (7 Hari)</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="h-[300px]">
          <Line v-if="chartData.labels && chartData.labels.length > 0" :data="chartData" :options="chartOptions" />
          <div v-else class="flex items-center justify-center h-full text-muted-foreground">
            Belum ada data
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Token Usage History (Reseller Only) -->
    <Card v-if="role === 'reseller'">
      <CardHeader class="flex flex-row items-center justify-between">
        <CardTitle class="flex items-center gap-2"><History class="h-4 w-4" /> Riwayat Penggunaan Token</CardTitle>
      </CardHeader>
      <CardContent>
        <div v-if="tokenLogs.length === 0" class="text-center text-muted-foreground py-6">
          Belum ada riwayat penggunaan token
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b">
                <th class="text-left py-2 px-2 font-medium text-muted-foreground">Waktu</th>
                <th class="text-left py-2 px-2 font-medium text-muted-foreground">Aksi</th>
                <th class="text-left py-2 px-2 font-medium text-muted-foreground">User</th>
                <th class="text-left py-2 px-2 font-medium text-muted-foreground">Durasi</th>
                <th class="text-right py-2 px-2 font-medium text-muted-foreground">Token</th>
                <th class="text-right py-2 px-2 font-medium text-muted-foreground">Sisa</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in tokenLogs" :key="log.id" class="border-b hover:bg-accent/50 transition-colors">
                <td class="py-2 px-2 text-xs text-muted-foreground">{{ formatDateTime(log.created_at) }}</td>
                <td class="py-2 px-2">
                  <span v-if="log.action === 'CREATE'" class="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">Buat User</span>
                  <span v-else class="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Perpanjang</span>
                </td>
                <td class="py-2 px-2 font-medium">{{ log.target_user }}</td>
                <td class="py-2 px-2">{{ log.duration_days }} hari</td>
                <td class="py-2 px-2 text-right font-bold text-amber-600">-{{ log.tokens_used }}</td>
                <td class="py-2 px-2 text-right text-muted-foreground">{{ log.balance_after }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>

    <Card v-if="role === 'admin'">
      <CardHeader>
        <CardTitle>Aktivitas Terbaru</CardTitle>
      </CardHeader>
      <CardContent>
        <div v-if="activities.length === 0" class="text-center text-muted-foreground py-4">
          Belum ada aktivitas
        </div>
        <div v-else class="space-y-4">
          <div v-for="act in activities" :key="act.id" class="flex items-start gap-3">
            <div class="w-2 h-2 bg-primary rounded-full mt-2"></div>
            <div class="flex-1">
              <p class="text-sm font-medium">{{ act.action }}</p>
              <p class="text-xs text-muted-foreground">{{ act.message }}</p>
              <p class="text-xs text-muted-foreground">{{ timeAgo(act.timestamp) }}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
