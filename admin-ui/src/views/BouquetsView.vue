<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import { Plus, Trash2, X, Pencil } from 'lucide-vue-next'
import { apiCall, formatRupiah } from '@/composables/useApi'

const bouquets = ref<any[]>([])
const loading = ref(true)
const showAddModal = ref(false)
const showEditModal = ref(false)
const form = ref({ name: '', price: 0, duration: 30 })
const editForm = ref({ id: 0, name: '', price: 0, duration: 30 })

onMounted(() => loadData())

const adminRole = ref('')

async function loadData() {
  loading.value = true
  try {
    const me = await apiCall('/api/auth/me')
    adminRole.value = me.role
    const data = await apiCall('/api/admin/bouquets')
    bouquets.value = data.bouquets || []
  } catch (err: any) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

async function addBouquet() {
  try {
    await apiCall('/api/admin/bouquets', 'POST', form.value)
    showAddModal.value = false
    form.value = { name: '', price: 0, duration: 30 }
    loadData()
  } catch (err: any) {
    alert(err.message)
  }
}

async function deleteBouquet(id: number) {
  if (!confirm('Hapus paket ini?')) return
  try {
    await apiCall(`/api/admin/bouquets/${id}`, 'DELETE')
    loadData()
  } catch (err: any) {
    alert(err.message)
  }
}

function openEdit(b: any) {
  editForm.value = { id: b.id, name: b.name, price: b.price || 0, duration: b.duration ?? 30 }
  showEditModal.value = true
}

async function saveEdit() {
  try {
    await apiCall(`/api/admin/bouquets/${editForm.value.id}`, 'PUT', editForm.value)
    showEditModal.value = false
    loadData()
  } catch (err: any) {
    alert(err.message)
  }
}

const durationOptions = [
  { value: 3, label: '3 Hari / Trial' },
  { value: 30, label: '30 Hari / 1 Bulan' },
  { value: 90, label: '90 Hari / 3 Bulan' },
  { value: 180, label: '180 Hari / 6 Bulan' },
  { value: 360, label: '360 Hari / 1 Tahun' },
  { value: 720, label: '720 Hari / 2 Tahun' },
  { value: 0, label: 'Lifetime' },
]

const availableDurationOptions = computed(() => {
  if (adminRole.value === 'reseller') {
    return durationOptions.filter(o => o.value !== 0)
  }
  return durationOptions
})

function durationLabel(d: number) {
  if (d === 0) return 'Lifetime'
  const opt = durationOptions.find(o => o.value === d)
  return opt ? opt.label : `${d} Hari`
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold tracking-tight">Paket Bouquet</h1>
        <p class="text-muted-foreground">Kelola paket langganan (semua saluran)</p>
      </div>
      <button @click="showAddModal = true" class="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
        <Plus :size="16" /> Tambah Paket
      </button>
    </div>

    <Card>
      <CardContent class="p-4">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b">
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">No</th>
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">Nama</th>
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">Harga</th>
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">Durasi</th>
                <th class="text-right py-3 px-2 font-medium text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="5" class="text-center py-8 text-muted-foreground">Memuat...</td>
              </tr>
              <tr v-else-if="bouquets.length === 0">
                <td colspan="5" class="text-center py-8 text-muted-foreground">Belum ada paket</td>
              </tr>
              <tr v-for="(b, i) in bouquets" :key="b.id" class="border-b hover:bg-accent/50 transition-colors">
                <td class="py-3 px-2 text-muted-foreground">{{ i + 1 }}</td>
                <td class="py-3 px-2 font-medium">{{ b.name }}</td>
                <td class="py-3 px-2">{{ formatRupiah(b.price) }}</td>
                <td class="py-3 px-2">{{ durationLabel(b.duration) }}</td>
                <td class="py-3 px-2 text-right">
                  <div class="flex justify-end gap-1">
                    <button @click="openEdit(b)" class="p-1.5 hover:bg-accent rounded-md text-blue-600" title="Edit">
                      <Pencil :size="14" />
                    </button>
                    <button @click="deleteBouquet(b.id)" class="p-1.5 hover:bg-red-50 text-red-500 rounded-md" title="Hapus">
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

    <!-- Add Modal -->
    <Teleport to="body">
      <div v-if="showAddModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div class="bg-card rounded-xl shadow-xl w-full max-w-md">
          <div class="flex items-center justify-between p-4 border-b">
            <h3 class="font-bold">Tambah Paket</h3>
            <button @click="showAddModal = false" class="p-1 hover:bg-accent rounded-md"><X :size="18" /></button>
          </div>
          <form @submit.prevent="addBouquet" class="p-4 space-y-3">
            <div>
              <label class="text-sm font-medium mb-1 block">Nama Paket</label>
              <input v-model="form.name" required class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" placeholder="cth. Paket Premium" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-sm font-medium mb-1 block">Harga (Rp)</label>
                <input v-model.number="form.price" type="number" min="0" class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" />
              </div>
              <div>
                <label class="text-sm font-medium mb-1 block">Durasi</label>
                <select v-model.number="form.duration" class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none">
                  <option v-for="opt in availableDurationOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
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
    <!-- Edit Modal -->
    <Teleport to="body">
      <div v-if="showEditModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div class="bg-card rounded-xl shadow-xl w-full max-w-md">
          <div class="flex items-center justify-between p-4 border-b">
            <h3 class="font-bold">Edit Paket</h3>
            <button @click="showEditModal = false" class="p-1 hover:bg-accent rounded-md"><X :size="18" /></button>
          </div>
          <form @submit.prevent="saveEdit" class="p-4 space-y-3">
            <div>
              <label class="text-sm font-medium mb-1 block">Nama Paket</label>
              <input v-model="editForm.name" required class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-sm font-medium mb-1 block">Harga (Rp)</label>
                <input v-model.number="editForm.price" type="number" min="0" class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" />
              </div>
              <div>
                <label class="text-sm font-medium mb-1 block">Durasi</label>
                <select v-model.number="editForm.duration" class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none">
                  <option v-for="opt in availableDurationOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button type="button" @click="showEditModal = false" class="px-4 py-2 border rounded-lg hover:bg-accent text-sm">Batal</button>
              <button type="submit" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">Simpan</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
