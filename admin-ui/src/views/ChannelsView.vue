<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import { List, Plus, Trash2, Upload, Search, X, CheckCircle, XCircle, Pencil, RefreshCw } from 'lucide-vue-next'

const checkingIds = ref<Set<number>>(new Set())
import { apiCall } from '@/composables/useApi'

const channels = ref<any[]>([])
const loading = ref(true)
const showImportModal = ref(false)
const showEditModal = ref(false)
const searchQuery = ref('')
const totalChannels = ref(0)

const editForm = ref({
  id: 0,
  name: '',
  url: '',
  group: '',
  logo: '',
  epg_id: 0,
  epg_chan_id: '',
  license_type: '',
  license_key: '',
  user_agent: '',
  referrer: '',
  extra_props: ''
})

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const data = await apiCall('/api/admin/channels?limit=9999')
    channels.value = data.channels || []
    totalChannels.value = channels.value.length
  } catch (err: any) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

async function importPlaylist(e: Event) {
  const form = e.target as HTMLFormElement
  const formData = new FormData(form)
  try {
    const res = await fetch('/api/admin/channels/import', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Import gagal')
    showImportModal.value = false
    alert(data.message || `Berhasil! ${data.imported || 0} saluran diimpor`)
    loadData()
  } catch (err: any) {
    alert(err.message)
  }
}

async function deleteChannel(id: number) {
  if (!confirm('Hapus saluran ini?')) return
  try {
    await apiCall(`/api/admin/channels/${id}`, 'DELETE')
    loadData()
  } catch (err: any) {
    alert(err.message)
  }
}

const checking = ref(false)
const checkProgress = ref('')

async function checkAllStreams() {
  if (!channels.value.length || checking.value) return
  checking.value = true
  const allIds = channels.value.map(c => c.id)
  const batchSize = 50
  let done = 0
  try {
    for (let i = 0; i < allIds.length; i += batchSize) {
      const batch = allIds.slice(i, i + batchSize)
      checkProgress.value = `${Math.min(done + batchSize, allIds.length)}/${allIds.length}`
      await apiCall('/api/admin/channels/batch-check', 'POST', { ids: batch })
      done += batch.length
    }
    checkProgress.value = ''
    alert('Pengecekan selesai!')
    loadData()
  } catch (err: any) {
    alert(err.message)
  } finally {
    checking.value = false
    checkProgress.value = ''
  }
}

function openEdit(ch: any) {
  editForm.value = {
    id: ch.id,
    name: ch.name || '',
    url: ch.url || '',
    group: ch.group_title || '',
    logo: ch.logo_url || '',
    epg_id: ch.epg_id || 0,
    epg_chan_id: ch.epg_channel_id || '',
    license_type: ch.license_type || '',
    license_key: ch.license_key || '',
    user_agent: ch.user_agent || '',
    referrer: ch.referrer || '',
    extra_props: ch.extra_props || ''
  }
  showEditModal.value = true
}

async function saveEdit() {
  try {
    await apiCall(`/api/admin/channels/${editForm.value.id}`, 'PUT', editForm.value)
    showEditModal.value = false
    loadData()
  } catch (err: any) {
    alert(err.message)
  }
}

async function checkChannel(id: number) {
  if (checkingIds.value.has(id)) return
  checkingIds.value.add(id)
  try {
    const data = await apiCall(`/api/admin/channels/${id}/check`)
    const ch = channels.value.find(c => c.id === id)
    if (ch) ch.status = data.result || 'unknown'
  } catch (err: any) {
    console.error(err)
  } finally {
    checkingIds.value.delete(id)
  }
}

const filteredChannels = () => {
  if (!searchQuery.value) return channels.value
  const q = searchQuery.value.toLowerCase()
  return channels.value.filter(c => c.name?.toLowerCase().includes(q) || c.group_title?.toLowerCase().includes(q))
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div>
        <h1 class="text-xl font-bold tracking-tight">Saluran</h1>
        <p class="text-muted-foreground">Total: {{ totalChannels }} saluran</p>
      </div>
      <div class="flex gap-2">
        <button @click="checkAllStreams" :disabled="checking" class="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-accent disabled:opacity-50">
          <CheckCircle :size="16" /> {{ checking ? `Mengecek ${checkProgress}...` : 'Cek Semua' }}
        </button>
        <button @click="showImportModal = true" class="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
          <Upload :size="16" /> Impor
        </button>
      </div>
    </div>

    <Card>
      <CardContent class="p-4">
        <div class="relative mb-4">
          <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input v-model="searchQuery" type="text" placeholder="Cari saluran..."
            class="w-full pl-10 pr-4 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b">
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">No</th>
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">Nama</th>
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">Grup</th>
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                <th class="text-right py-3 px-2 font-medium text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="5" class="text-center py-8 text-muted-foreground">Memuat...</td>
              </tr>
              <tr v-else-if="filteredChannels().length === 0">
                <td colspan="5" class="text-center py-8 text-muted-foreground">Tidak ada data</td>
              </tr>
              <tr v-for="(ch, i) in filteredChannels()" :key="ch.id" class="border-b hover:bg-accent/50 transition-colors">
                <td class="py-3 px-2 text-muted-foreground">{{ i + 1 }}</td>
                <td class="py-3 px-2 font-medium">{{ ch.name }}</td>
                <td class="py-3 px-2">
                  <span class="px-2 py-0.5 bg-accent text-sm rounded">{{ ch.group_title || '-' }}</span>
                </td>
                <td class="py-3 px-2">
                  <span :class="[
                    'px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1',
                    ch.status === 'online' ? 'bg-green-100 text-green-700' : ch.status === 'offline' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                  ]">
                    <CheckCircle v-if="ch.status === 'online'" :size="12" />
                    <XCircle v-else-if="ch.status === 'offline'" :size="12" />
                    {{ ch.status || 'Belum dicek' }}
                  </span>
                </td>
                <td class="py-3 px-2 text-right">
                  <div class="flex justify-end gap-1">
                    <button @click="checkChannel(ch.id)" :disabled="checkingIds.has(ch.id)" class="p-1.5 hover:bg-accent rounded-md text-green-600 disabled:opacity-50" title="Cek Stream">
                      <RefreshCw :size="14" :class="{ 'animate-spin': checkingIds.has(ch.id) }" />
                    </button>
                    <button @click="openEdit(ch)" class="p-1.5 hover:bg-accent rounded-md text-blue-600" title="Edit">
                      <Pencil :size="14" />
                    </button>
                    <button @click="deleteChannel(ch.id)" class="p-1.5 hover:bg-red-50 text-red-500 rounded-md" title="Hapus">
                      <Trash2 :size="14" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>

    <!-- Edit Modal -->
    <Teleport to="body">
      <div v-if="showEditModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div class="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between p-4 border-b sticky top-0 bg-card z-10">
            <h3 class="font-bold">Edit Saluran</h3>
            <button @click="showEditModal = false" class="p-1 hover:bg-accent rounded-md"><X :size="18" /></button>
          </div>
          <form @submit.prevent="saveEdit" class="p-4 space-y-4">
            <!-- Basic Info -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="text-sm font-medium mb-1 block">Nama Saluran</label>
                <input v-model="editForm.name" required
                  class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" />
              </div>
              <div>
                <label class="text-sm font-medium mb-1 block">Grup</label>
                <input v-model="editForm.group"
                  class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" />
              </div>
            </div>

            <!-- URL -->
            <div>
              <label class="text-sm font-medium mb-1 block">URL Stream</label>
              <input v-model="editForm.url" required
                class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none font-mono text-xs" />
            </div>

            <!-- Logo & EPG -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="text-sm font-medium mb-1 block">Logo URL</label>
                <input v-model="editForm.logo"
                  class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none text-xs" />
              </div>
              <div>
                <label class="text-sm font-medium mb-1 block">EPG ID</label>
                <input v-model.number="editForm.epg_id" type="number"
                  class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" />
              </div>
              <div>
                <label class="text-sm font-medium mb-1 block">EPG Channel ID</label>
                <input v-model="editForm.epg_chan_id"
                  class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" />
              </div>
            </div>

            <!-- DRM / License -->
            <div class="border-t pt-4">
              <p class="text-sm font-semibold mb-3 text-muted-foreground">DRM / License</p>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="text-sm font-medium mb-1 block">License Type</label>
                  <input v-model="editForm.license_type" placeholder="cth. com.widevine.alpha"
                    class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none text-xs" />
                </div>
                <div>
                  <label class="text-sm font-medium mb-1 block">License Key</label>
                  <input v-model="editForm.license_key"
                    class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none text-xs" />
                </div>
              </div>
            </div>

            <!-- Headers -->
            <div class="border-t pt-4">
              <p class="text-sm font-semibold mb-3 text-muted-foreground">HTTP Headers</p>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="text-sm font-medium mb-1 block">User-Agent</label>
                  <input v-model="editForm.user_agent"
                    class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none text-xs" />
                </div>
                <div>
                  <label class="text-sm font-medium mb-1 block">Referrer</label>
                  <input v-model="editForm.referrer"
                    class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none text-xs" />
                </div>
              </div>
            </div>

            <!-- Extra Props -->
            <div class="border-t pt-4">
              <label class="text-sm font-medium mb-1 block">Extra Properties</label>
              <textarea v-model="editForm.extra_props" rows="3"
                class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none font-mono text-xs"
                placeholder="#KODIPROP:..."></textarea>
            </div>

            <div class="flex justify-end gap-2 pt-2 border-t">
              <button type="button" @click="showEditModal = false" class="px-4 py-2 border rounded-lg hover:bg-accent text-sm">Batal</button>
              <button type="submit" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">Simpan</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Import Modal -->
    <Teleport to="body">
      <div v-if="showImportModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div class="bg-card rounded-xl shadow-xl w-full max-w-md">
          <div class="flex items-center justify-between p-4 border-b">
            <h3 class="font-bold">Impor Playlist</h3>
            <button @click="showImportModal = false" class="p-1 hover:bg-accent rounded-md"><X :size="18" /></button>
          </div>
          <form @submit.prevent="importPlaylist" class="p-4 space-y-3">
            <div>
              <label class="text-sm font-medium mb-1 block">File M3U / URL</label>
              <input name="url" type="text" placeholder="URL playlist atau upload file"
                class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" />
            </div>
            <div>
              <label class="text-sm font-medium mb-1 block">Atau upload file</label>
              <input name="m3u_file" type="file" accept=".m3u,.m3u8"
                class="w-full px-3 py-2 border rounded-lg bg-background" />
            </div>
            <div class="flex items-center gap-2 pt-1">
              <input name="clear_first" type="checkbox" id="clearFirst" value="true" class="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" />
              <label for="clearFirst" class="text-sm text-muted-foreground">Hapus semua channel lama sebelum import</label>
            </div>
            <div class="bg-blue-50 text-blue-700 text-xs p-2 rounded-lg">
              💡 Channel duplikat (nama + URL sama) akan otomatis dilewati
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button type="button" @click="showImportModal = false" class="px-4 py-2 border rounded-lg hover:bg-accent text-sm">Batal</button>
              <button type="submit" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">Impor</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
