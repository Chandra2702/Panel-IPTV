<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardTitle from '@/components/ui/CardTitle.vue'
import CardContent from '@/components/ui/CardContent.vue'
import { Users, Plus, Trash2, Edit, Search, X, Link, Unlock, MessageCircle, Copy, ExternalLink, Clock } from 'lucide-vue-next'
import { apiCall } from '@/composables/useApi'

const users = ref<any[]>([])
const loading = ref(true)
const showAddModal = ref(false)
const showEditModal = ref(false)
const showExtendModal = ref(false)
const editUser = ref<any>({})
const extendForm = ref({ user: null as any, username: '', exp_date: '', duration: 30, new_bouquet_id: '' })
const searchQuery = ref('')
const showShareModal = ref(false)
const shareData = ref({ username: '', password: '', expDate: '', bouquetName: '', shortlink: '' })

const form = ref({ username: '', password: '', max_connections: 1, bouquet_id: '' })
const bouquets = ref<any[]>([])
const adminRole = ref('')
const adminCredits = ref(0)
const adminId = ref<number | null>(null)

function getTokenCost(days: number): number {
  if (!days || days <= 0 || days === -1) return 0
  if (days <= 3) return 0
  if (days <= 30) return 1
  if (days <= 90) return 3
  if (days <= 180) return 6
  if (days <= 360) return 12
  if (days <= 720) return 20
  return Math.ceil(days / 30)
}

const createTokenCost = computed(() => {
  const b = bouquets.value.find((b: any) => b.id == form.value.bouquet_id)
  return b ? getTokenCost(b.duration ?? 30) : 0
})

const extendTokenCost = computed(() => {
  return getTokenCost(extendForm.value.duration)
})

const filteredExtendBouquets = computed(() => {
  if (!extendForm.value.user) return []
  return bouquets.value.filter(b => b.owner_id === extendForm.value.user.owner_id)
})

const filteredCreateBouquets = computed(() => {
  if (!adminId.value) return []
  return bouquets.value.filter(b => b.owner_id === adminId.value)
})

onMounted(() => { loadData(); fetchAdminInfo() })

async function fetchAdminInfo() {
  try {
    const me = await apiCall('/api/auth/me')
    adminRole.value = me.role
    adminCredits.value = me.credits
    adminId.value = me.id
  } catch {}
}

async function loadData() {
  loading.value = true
  try {
    const data = await apiCall('/api/admin/users')
    users.value = data.users || []
    bouquets.value = data.bouquets || []
  } catch (err: any) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

async function addUser() {
  try {
    const selectedBouquet = bouquets.value.find(b => b.id == form.value.bouquet_id)
    const duration = selectedBouquet ? (selectedBouquet.duration ?? 30) : 30
    const result = await apiCall('/api/admin/users', 'POST', {
      username: form.value.username,
      password: form.value.password,
      max_connections: form.value.max_connections,
      duration: duration === 0 ? -1 : duration,
      bouquets: form.value.bouquet_id ? [form.value.bouquet_id] : []
    })

    // Generate shortlink for this user
    let shortlink = ''
    try {
      const slData = await apiCall('/api/admin/shortlinks/generate-for-user', 'POST', { user_id: result.id })
      shortlink = `${window.location.origin}/${slData.slug}`
    } catch {}

    // Calculate expiry
    const expDate = new Date()
    if (duration > 0) {
      expDate.setDate(expDate.getDate() + duration)
    }

    shareData.value = {
      username: form.value.username,
      password: form.value.password,
      expDate: duration > 0 ? expDate.toLocaleDateString('id-ID') : 'Selamanya',
      bouquetName: selectedBouquet?.name || '-',
      shortlink
    }

    showAddModal.value = false
    showShareModal.value = true
    form.value = { username: '', password: '', max_connections: 1, bouquet_id: '' }
    if (result.credits !== undefined) adminCredits.value = result.credits
    loadData()
  } catch (err: any) {
    alert(err.message)
  }
}

function getShareText() {
  const s = shareData.value
  // Use explicit encoding for emojis to avoid ? issues
  const EMOJI = {
    CLAP: '\uD83C\uDFAC', // 🎬
    USER: '\uD83D\uDC64', // 👤
    KEY: '\uD83D\uDD11',  // 🔑
    BOX: '\uD83D\uDCE6',  // 📦
    CAL: '\uD83D\uDCC5',  // 📅
    LINK: '\uD83D\uDD17', // 🔗
    PRAY: '\uD83D\uDE4F'  // 🙏
  }
  
  const lines = [
    `${EMOJI.CLAP} *Akun IPTV Anda*`,
    '',
    `${EMOJI.USER} Username: ` + s.username,
    `${EMOJI.KEY} Password: ` + s.password,
    `${EMOJI.BOX} Paket: ` + s.bouquetName,
    `${EMOJI.CAL} Berlaku s/d: ` + s.expDate,
  ]
  if (s.shortlink) {
    lines.push('')
    lines.push(`${EMOJI.LINK} Link Playlist:`)
    lines.push(s.shortlink)
  }
  lines.push('')
  lines.push(`${EMOJI.PRAY} _Terima kasih telah berlangganan!_`)
  return lines.join('\n')
}

function shareWhatsApp() {
  const text = getShareText()
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
}

async function copyShareText() {
  await navigator.clipboard.writeText(getShareText())
  alert('Teks berhasil disalin!')
}

async function openEdit(user: any) {
  editUser.value = { ...user }
  // Map bouquets string to bouquet_id for select input
  // Taking the first bouquet if multiple are assigned (though UI only supports one currently)
  if (user.bouquets) {
    const ids = String(user.bouquets).split(',')
    editUser.value.bouquet_id = ids[0]
  } else {
    editUser.value.bouquet_id = ''
  }
  showEditModal.value = true
}

async function updateUser() {
  try {
    await apiCall(`/api/admin/users/${editUser.value.id}`, 'PUT', {
      password: editUser.value.password || undefined,
      max_connections: editUser.value.max_connections,
      exp_date: editUser.value.exp_date || null,
      bouquets: editUser.value.bouquet_id ? [editUser.value.bouquet_id] : []
    })
    showEditModal.value = false
    loadData()
  } catch (err: any) {
    alert(err.message)
  }
}

async function deleteUser(id: number) {
  if (!confirm('Hapus pengguna ini?')) return
  try {
    await apiCall(`/api/admin/users/${id}`, 'DELETE')
    loadData()
  } catch (err: any) {
    alert(err.message)
  }
}

const filteredUsers = () => {
  if (!searchQuery.value) return users.value
  const q = searchQuery.value.toLowerCase()
  return users.value.filter(u => u.username?.toLowerCase().includes(q))
}

function formatDate(d: string) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID')
}

function isUserActive(user: any) {
  if (!user.exp_date) return true // no expiry = always active
  const today = new Date().toISOString().split('T')[0]
  return today <= user.exp_date.split('T')[0]
}

function getBouquetName(user: any) {
  if (!user.bouquets) return '-'
  const ids = String(user.bouquets).split(',').map(Number)
  const names = ids.map(id => bouquets.value.find(b => b.id === id)?.name).filter(Boolean)
  return names.length ? names.join(', ') : '-'
}

async function generateShortlink(userId: number) {
  try {
    const data = await apiCall('/api/admin/shortlinks/generate-for-user', 'POST', { user_id: userId })
    const url = `${window.location.origin}/${data.slug}`
    await navigator.clipboard.writeText(url)
    alert(`Shortlink dibuat & disalin!\n${url}`)
  } catch (err: any) {
    alert(err.message)
  }
}

async function unlockDevice(userId: number) {
  if (!confirm('Buka kunci perangkat untuk pengguna ini?')) return
  try {
    await apiCall(`/api/admin/users/${userId}/reset-ip`, 'POST')
    alert('Perangkat berhasil dibuka kuncinya!')
    loadData()
  } catch (err: any) {
    alert(err.message)
    alert(err.message)
  }
}

async function openShareModal(user: any) {
  // Ensure shortlink exists
  let shortlink = ''
  try {
    const slData = await apiCall('/api/admin/shortlinks/generate-for-user', 'POST', { user_id: user.id })
    shortlink = `${window.location.origin}/${slData.slug}`
  } catch {}

  shareData.value = {
    username: user.username,
    password: user.password || '******', // Use stored plain password if available
    expDate: formatDate(user.exp_date),
    bouquetName: getBouquetName(user),
    shortlink
  }
  showShareModal.value = true
}

async function openExtend(user: any) {
  extendForm.value = { 
    user, 
    username: user.username,
    exp_date: user.exp_date,
    duration: 30,
    new_bouquet_id: ''
  }
  showExtendModal.value = true
}

const selectPackage = (b: any) => {
  extendForm.value.duration = b.duration ?? 30
  extendForm.value.new_bouquet_id = b.id
}

async function extendDuration() {
  try {
    const res = await apiCall(`/api/admin/users/${extendForm.value.user.id}/extend`, 'POST', {
      duration: extendForm.value.duration,
      new_bouquet_id: extendForm.value.new_bouquet_id
    })
    
    // Update local data
    const updatedUser = { 
        ...extendForm.value.user, 
        exp_date: res.new_exp_date,
        bouquets: res.new_bouquets // Update local bouquets
    }
    
    // Prepare share data
    shareData.value = {
      username: updatedUser.username,
      password: updatedUser.password || '******',
      expDate: formatDate(res.new_exp_date),
      bouquetName: getBouquetName(updatedUser),
      shortlink: '' // Will try to fetch below
    }
    
    // Try fetch shortlink
    try {
      const slData = await apiCall('/api/admin/shortlinks/generate-for-user', 'POST', { user_id: updatedUser.id })
      shareData.value.shortlink = `${window.location.origin}/${slData.slug}`
    } catch {}

    showExtendModal.value = false
    showShareModal.value = true
    if (res.credits !== undefined) adminCredits.value = res.credits
    loadData()
  } catch (err: any) {
    alert(err.message)
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold tracking-tight">Pengguna</h1>
        <p class="text-muted-foreground">Kelola pelanggan IPTV</p>
      </div>
      <button @click="showAddModal = true" class="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
        <Plus :size="16" /> Tambah
      </button>
    </div>

    <Card>
      <CardContent class="p-4">
        <div class="relative mb-4">
          <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input v-model="searchQuery" type="text" placeholder="Cari pengguna..."
            class="w-full pl-10 pr-4 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b">
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">No</th>
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">Username</th>
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">Paket</th>
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">Kedaluwarsa</th>
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">Koneksi</th>
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">Perangkat</th>
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">Dibuat Oleh</th>
                <th class="text-right py-3 px-2 font-medium text-muted-foreground w-[100px]">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="9" class="text-center py-8 text-muted-foreground">Memuat...</td>
              </tr>
              <tr v-else-if="filteredUsers().length === 0">
                <td colspan="9" class="text-center py-8 text-muted-foreground">Tidak ada data</td>
              </tr>
              <tr v-for="(user, i) in filteredUsers()" :key="user.id" class="border-b hover:bg-accent/50 transition-colors">
                <td class="py-3 px-2 text-muted-foreground">{{ i + 1 }}</td>
                <td class="py-3 px-2">
                  <span :class="[
                    'px-2 py-1 rounded-full text-xs font-medium',
                    isUserActive(user) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  ]">{{ isUserActive(user) ? 'Aktif' : 'Nonaktif' }}</span>
                </td>
                <td class="py-3 px-2 font-medium">{{ user.username }}</td>
                <td class="py-3 px-2">{{ getBouquetName(user) }}</td>
                <td class="py-3 px-2">{{ formatDate(user.exp_date) }}</td>
                <td class="py-3 px-2">{{ user.max_connections || 1 }}</td>
                <td class="py-3 px-2">
                  <span v-if="user.ip_lock" class="text-xs text-muted-foreground font-mono">{{ user.ip_lock }}</span>
                  <span v-else class="text-xs text-muted-foreground">-</span>
                </td>
                <td class="py-3 px-2 text-muted-foreground">{{ user.owner_name || 'admin' }}</td>
                <td class="py-3 px-2 text-right">
                  <div class="flex justify-end gap-1">
                    <button @click="openEdit(user)" class="p-1.5 hover:bg-accent rounded-md text-primary" title="Kelola / Edit">
                      <Edit :size="16" />
                    </button>
                    <button @click="deleteUser(user.id)" class="p-1.5 hover:bg-red-50 text-red-500 rounded-md" title="Hapus">
                      <Trash2 :size="16" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>

    <!-- Add Modal -->
    <Teleport to="body">
      <div v-if="showAddModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div class="bg-card rounded-xl shadow-xl w-full max-w-md">
          <div class="flex items-center justify-between p-4 border-b">
            <h3 class="font-bold">Buat Pengguna Baru</h3>
            <button @click="showAddModal = false" class="p-1 hover:bg-accent rounded-md"><X :size="18" /></button>
          </div>
          <form @submit.prevent="addUser" class="p-4 space-y-3">
            <div>
              <label class="text-sm font-medium mb-1 block">Username</label>
              <input v-model="form.username" required class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" />
            </div>
            <div>
              <label class="text-sm font-medium mb-1 block">Password</label>
              <input v-model="form.password" type="password" required class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" />
            </div>
            <div>
              <label class="text-sm font-medium mb-1 block">Maks Koneksi</label>
              <input v-model.number="form.max_connections" type="number" min="1" class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" />
            </div>
            <div>
              <label class="text-sm font-medium mb-1 block">Bouquet</label>
              <select v-model="form.bouquet_id" required class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none">
                <option value="">-- Pilih Bouquet --</option>
                <option v-for="b in filteredCreateBouquets" :key="b.id" :value="b.id">{{ b.name }}</option>
              </select>
              <div v-if="adminRole === 'reseller' && form.bouquet_id" class="mt-2 flex items-center gap-2 text-sm">
                <span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium">🪙 {{ createTokenCost }} Token</span>
                <span class="text-muted-foreground">(Sisa: {{ adminCredits }})</span>
              </div>
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button type="button" @click="showAddModal = false" class="px-4 py-2 border rounded-lg hover:bg-accent text-sm">Batal</button>
              <button type="submit" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">Simpan</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- WhatsApp Share Modal -->
    <Teleport to="body">
      <div v-if="showShareModal" class="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
        <div class="bg-card rounded-xl shadow-xl w-full max-w-md">
          <div class="flex items-center justify-between p-4 border-b">
            <h3 class="font-bold flex items-center gap-2">✅ Pengguna Berhasil Dibuat</h3>
            <button @click="showShareModal = false" class="p-1 hover:bg-accent rounded-md"><X :size="18" /></button>
          </div>
          <div class="p-4 space-y-3">
            <div class="bg-gray-50 rounded-lg p-4 space-y-2 text-sm font-mono">
              <div class="flex justify-between"><span class="text-muted-foreground">Username:</span><span class="font-bold">{{ shareData.username }}</span></div>
              <div class="flex justify-between"><span class="text-muted-foreground">Password:</span><span class="font-bold">{{ shareData.password }}</span></div>
              <div class="flex justify-between"><span class="text-muted-foreground">Paket:</span><span>{{ shareData.bouquetName }}</span></div>
              <div class="flex justify-between"><span class="text-muted-foreground">Berlaku s/d:</span><span>{{ shareData.expDate }}</span></div>
              <div v-if="shareData.shortlink" class="pt-2 border-t">
                <span class="text-muted-foreground">Link Playlist:</span>
                <a :href="shareData.shortlink" target="_blank" class="text-primary block truncate hover:underline">{{ shareData.shortlink }}</a>
              </div>
            </div>
            <div class="flex gap-2 pt-2">
              <button @click="shareWhatsApp" class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors">
                <MessageCircle :size="18" /> Kirim via WhatsApp
              </button>
              <button @click="copyShareText" class="flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium hover:bg-accent transition-colors">
                <Copy :size="16" /> Salin
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Edit Modal -->
    <Teleport to="body">
      <div v-if="showEditModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div class="bg-card rounded-xl shadow-xl w-full max-w-md">
          <div class="flex items-center justify-between p-4 border-b">
            <h3 class="font-bold">Kelola Pengguna</h3>
            <button @click="showEditModal = false" class="p-1 hover:bg-accent rounded-md"><X :size="18" /></button>
          </div>
          <div class="p-4 space-y-4">
             <!-- Quick Actions -->
             <div class="grid grid-cols-3 gap-2">
                <button @click="openExtend(editUser)" class="flex flex-col items-center justify-center p-2 border rounded-lg hover:bg-accent hover:border-primary/50 transition-colors gap-1 text-xs font-medium text-center">
                   <Clock :size="18" class="text-purple-600" />
                   <span>Perpanjang</span>
                </button>
                <button @click="unlockDevice(editUser.id)" class="flex flex-col items-center justify-center p-2 border rounded-lg hover:bg-accent hover:border-primary/50 transition-colors gap-1 text-xs font-medium text-center" :disabled="!editUser.ip_lock" :class="{'opacity-50 cursor-not-allowed': !editUser.ip_lock}">
                   <Unlock :size="18" class="text-orange-500" />
                   <span>Reset IP</span>
                </button>
                <button @click="openShareModal(editUser)" class="flex flex-col items-center justify-center p-2 border rounded-lg hover:bg-accent hover:border-primary/50 transition-colors gap-1 text-xs font-medium text-center">
                   <MessageCircle :size="18" class="text-green-600" />
                   <span>Share</span>
                </button>
             </div>
             
             <div class="border-t"></div>

             <form @submit.prevent="updateUser" class="space-y-3 pt-1">
            <div>
              <label class="text-sm font-medium mb-1 block">Username</label>
              <input v-model="editUser.username" required class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" />
            </div>
            <div>
              <label class="text-sm font-medium mb-1 block">Password (kosongkan jika tidak diubah)</label>
              <input v-model="editUser.password" type="password" class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" placeholder="••••••" />
            </div>
            <div>
              <label class="text-sm font-medium mb-1 block">Maks Koneksi</label>
              <input v-model.number="editUser.max_connections" type="number" min="1" disabled class="w-full px-3 py-2 border rounded-lg bg-gray-100 text-muted-foreground cursor-not-allowed" />
            </div>
            <div>
              <label class="text-sm font-medium mb-1 block">Bouquet (Paket)</label>
              <select v-model="editUser.bouquet_id" disabled class="w-full px-3 py-2 border rounded-lg bg-gray-100 text-muted-foreground cursor-not-allowed">
                <option value="">-- Pilih Bouquet --</option>
                <option v-for="b in bouquets" :key="b.id" :value="b.id">{{ b.name }}</option>
              </select>
            </div>
            <div>
              <label class="text-sm font-medium mb-1 block">IP Perangkat Terhubung</label>
              <input :value="editUser.ip_lock || '-'" disabled class="w-full px-3 py-2 border rounded-lg bg-gray-100 text-muted-foreground cursor-not-allowed font-mono text-xs" />
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button type="button" @click="showEditModal = false" class="px-4 py-2 border rounded-lg hover:bg-accent text-sm">Batal</button>
              <button type="submit" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">Simpan Perubahan</button>
            </div>
          </form>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Extend Modal -->
    <Teleport to="body">
      <div v-if="showExtendModal" class="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
        <div class="bg-card rounded-xl shadow-xl w-full max-w-md">
          <div class="flex items-center justify-between p-4 border-b">
            <h3 class="font-bold">Perpanjang Durasi</h3>
            <button @click="showExtendModal = false" class="p-1 hover:bg-accent rounded-md"><X :size="18" /></button>
          </div>
          <form @submit.prevent="extendDuration" class="p-4 space-y-3">
            <div class="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm mb-2">
              <p>User: <strong>{{ extendForm.username }}</strong></p>
              <p>Expired: <strong>{{ formatDate(extendForm.exp_date) }}</strong></p>
            </div>
            
            <div>
              <label class="text-sm font-medium mb-1 block">Pilih Durasi Paket</label>
              <div class="grid grid-cols-2 gap-2 mb-3">
                <button 
                  v-for="b in filteredExtendBouquets" 
                  :key="b.id"
                  type="button" 
                  @click="selectPackage(b)" 
                  class="px-3 py-2 border rounded-lg text-sm text-left hover:bg-accent transition-colors flex justify-between items-center"
                  :class="{'ring-2 ring-primary border-primary': extendForm.duration === (b.duration ?? 30) && extendForm.new_bouquet_id === b.id}"
                >
                  <span class="truncate">{{ b.name }}</span>
                  <span class="text-xs bg-secondary px-1.5 py-0.5 rounded">{{ b.duration === 0 ? 'Lifetime' : (b.duration ?? 30) + 'hr' }}</span>
                </button>
              </div>
              
              <label class="text-sm font-medium mb-1 block">Atau Input Manual (Hari)</label>
              <input v-model.number="extendForm.duration" type="number" min="0" required class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" />
              <div v-if="adminRole === 'reseller'" class="mt-2 flex items-center gap-2 text-sm">
                <span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium">🪙 {{ extendTokenCost }} Token</span>
                <span class="text-muted-foreground">(Sisa: {{ adminCredits }})</span>
              </div>
              <p v-else class="text-xs text-muted-foreground mt-1">*Admin: Gratis tanpa token</p>
            </div>
            
            <div class="flex justify-end gap-2 pt-2">
              <button type="button" @click="showExtendModal = false" class="px-4 py-2 border rounded-lg hover:bg-accent text-sm">Batal</button>
              <button type="submit" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">Perpanjang</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
