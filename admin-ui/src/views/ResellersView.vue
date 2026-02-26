<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import { UserCheck, Plus, Trash2, X, Edit, Coins } from 'lucide-vue-next'
import { apiCall } from '@/composables/useApi'

const resellers = ref<any[]>([])
const loading = ref(true)
const showAddModal = ref(false)
const showEditModal = ref(false)
const showCreditModal = ref(false)

const form = ref({ username: '', password: '', credits: 0 })
const editForm = ref({ id: 0, username: '', password: '' })
const creditForm = ref({ id: 0, amount: 0, username: '' })

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const data = await apiCall('/api/admin/resellers')
    resellers.value = data.resellers || []
  } catch (err: any) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

async function addReseller() {
  try {
    await apiCall('/api/admin/resellers', 'POST', form.value)
    showAddModal.value = false
    form.value = { username: '', password: '', credits: 0 }
    loadData()
  } catch (err: any) {
    alert(err.message)
  }
}

async function deleteReseller(id: number) {
  if (!confirm('Hapus reseller ini?')) return
  try {
    await apiCall(`/api/admin/resellers/${id}`, 'DELETE')
    loadData()
  } catch (err: any) {
    alert(err.message)
  }
}


async function openEdit(r: any) {
  editForm.value = { id: r.id, username: r.username, password: '' }
  showEditModal.value = true
}

async function updateReseller() {
  try {
    await apiCall(`/api/admin/resellers/${editForm.value.id}`, 'PUT', {
      username: editForm.value.username,
      password: editForm.value.password || undefined
    })
    showEditModal.value = false
    loadData()
  } catch (err: any) {
    alert(err.message)
  }
}

function openCredit(r: any) {
  creditForm.value = { id: r.id, amount: 0, username: r.username }
  showCreditModal.value = true
}

async function addCredits() {
  try {
    await apiCall(`/api/admin/resellers/${creditForm.value.id}/add-credits`, 'POST', {
      amount: creditForm.value.amount
    })
    showCreditModal.value = false
    loadData()
    alert('Kredit berhasil ditambahkan!')
  } catch (err: any) {
    alert(err.message)
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold tracking-tight">Reseller</h1>
        <p class="text-muted-foreground">Kelola akun reseller</p>
      </div>
      <button @click="showAddModal = true" class="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
        <Plus :size="16" /> Tambah
      </button>
    </div>

    <Card>
      <CardContent class="p-4">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b">
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">No</th>
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">Username</th>
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">Kredit</th>
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">Pengguna Dibuat</th>
                <th class="text-right py-3 px-2 font-medium text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading"><td colspan="5" class="text-center py-8 text-muted-foreground">Memuat...</td></tr>
              <tr v-else-if="resellers.length === 0"><td colspan="5" class="text-center py-8 text-muted-foreground">Tidak ada data</td></tr>
              <tr v-for="(r, i) in resellers" :key="r.id" class="border-b hover:bg-accent/50 transition-colors">
                <td class="py-3 px-2 text-muted-foreground">{{ i + 1 }}</td>
                <td class="py-3 px-2 font-medium">{{ r.username }}</td>
                <td class="py-3 px-2">{{ r.credits || 0 }}</td>
                <td class="py-3 px-2">{{ r.user_count || 0 }}</td>
                <td class="py-3 px-2 text-right">
                  <div class="flex justify-end gap-1">
                    <button @click="openCredit(r)" class="p-1.5 hover:bg-amber-50 text-amber-600 rounded-md" title="Tambah Kredit">
                      <Coins :size="14" />
                    </button>
                    <button @click="openEdit(r)" class="p-1.5 hover:bg-accent rounded-md" title="Edit">
                      <Edit :size="14" />
                    </button>
                    <button @click="deleteReseller(r.id)" class="p-1.5 hover:bg-red-50 text-red-500 rounded-md" title="Hapus">
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

    <Teleport to="body">
      <div v-if="showAddModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div class="bg-card rounded-xl shadow-xl w-full max-w-sm">
          <div class="flex items-center justify-between p-4 border-b">
            <h3 class="font-bold">Tambah Reseller</h3>
            <button @click="showAddModal = false" class="p-1 hover:bg-accent rounded-md"><X :size="18" /></button>
          </div>
          <form @submit.prevent="addReseller" class="p-4 space-y-3">
            <div>
              <label class="text-sm font-medium mb-1 block">Username</label>
              <input v-model="form.username" required class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" />
            </div>
            <div>
              <label class="text-sm font-medium mb-1 block">Password</label>
              <input v-model="form.password" type="password" required class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" />
            </div>
            <div>
              <label class="text-sm font-medium mb-1 block">Kredit</label>
              <input v-model.number="form.credits" type="number" min="0" class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" />
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
        <div class="bg-card rounded-xl shadow-xl w-full max-w-sm">
          <div class="flex items-center justify-between p-4 border-b">
            <h3 class="font-bold">Edit Reseller</h3>
            <button @click="showEditModal = false" class="p-1 hover:bg-accent rounded-md"><X :size="18" /></button>
          </div>
          <form @submit.prevent="updateReseller" class="p-4 space-y-3">
            <div>
              <label class="text-sm font-medium mb-1 block">Username</label>
              <input v-model="editForm.username" required class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" />
            </div>
            <div>
              <label class="text-sm font-medium mb-1 block">Password (kosongkan jika tidak ubah)</label>
              <input v-model="editForm.password" type="password" class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" placeholder="••••••" />
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button type="button" @click="showEditModal = false" class="px-4 py-2 border rounded-lg hover:bg-accent text-sm">Batal</button>
              <button type="submit" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">Simpan</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Add Credit Modal -->
    <Teleport to="body">
      <div v-if="showCreditModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div class="bg-card rounded-xl shadow-xl w-full max-w-sm">
          <div class="flex items-center justify-between p-4 border-b">
            <h3 class="font-bold">Tambah Kredit</h3>
            <button @click="showCreditModal = false" class="p-1 hover:bg-accent rounded-md"><X :size="18" /></button>
          </div>
          <form @submit.prevent="addCredits" class="p-4 space-y-3">
            <div class="text-sm text-muted-foreground mb-2">
              Menambahkan kredit untuk <strong>{{ creditForm.username }}</strong>
            </div>
            <div>
              <label class="text-sm font-medium mb-1 block">Jumlah Kredit</label>
              <input v-model.number="creditForm.amount" type="number" min="1" required class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" />
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button type="button" @click="showCreditModal = false" class="px-4 py-2 border rounded-lg hover:bg-accent text-sm">Batal</button>
              <button type="submit" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">Tambah</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
