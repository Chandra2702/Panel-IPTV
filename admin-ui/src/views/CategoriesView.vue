<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import { Tags, Plus, Trash2, X } from 'lucide-vue-next'
import { apiCall } from '@/composables/useApi'

const categories = ref<any[]>([])
const loading = ref(true)
const showAddModal = ref(false)
const form = ref({ name: '' })

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const data = await apiCall('/api/admin/categories')
    categories.value = data.categories || []
  } catch (err: any) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

async function addCategory() {
  try {
    await apiCall('/api/admin/categories', 'POST', form.value)
    showAddModal.value = false
    form.value = { name: '' }
    loadData()
  } catch (err: any) {
    alert(err.message)
  }
}

async function deleteCategory(id: number) {
  if (!confirm('Hapus kategori ini?')) return
  try {
    await apiCall(`/api/admin/categories/${id}`, 'DELETE')
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
        <h1 class="text-xl font-bold tracking-tight">Kategori</h1>
        <p class="text-muted-foreground">Kelola kategori saluran</p>
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
                <th class="text-left py-3 px-2 font-medium text-muted-foreground">Nama</th>
                <th class="text-right py-3 px-2 font-medium text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading"><td colspan="3" class="text-center py-8 text-muted-foreground">Memuat...</td></tr>
              <tr v-else-if="categories.length === 0"><td colspan="3" class="text-center py-8 text-muted-foreground">Tidak ada data</td></tr>
              <tr v-for="(cat, i) in categories" :key="cat.id" class="border-b hover:bg-accent/50 transition-colors">
                <td class="py-3 px-2 text-muted-foreground">{{ i + 1 }}</td>
                <td class="py-3 px-2 font-medium">{{ cat.name }}</td>
                <td class="py-3 px-2 text-right">
                  <button @click="deleteCategory(cat.id)" class="p-1.5 hover:bg-red-50 text-red-500 rounded-md" title="Hapus">
                    <Trash2 :size="14" />
                  </button>
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
            <h3 class="font-bold">Tambah Kategori</h3>
            <button @click="showAddModal = false" class="p-1 hover:bg-accent rounded-md"><X :size="18" /></button>
          </div>
          <form @submit.prevent="addCategory" class="p-4 space-y-3">
            <div>
              <label class="text-sm font-medium mb-1 block">Nama Kategori</label>
              <input v-model="form.name" required class="w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:outline-none" placeholder="cth. Sports" />
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button type="button" @click="showAddModal = false" class="px-4 py-2 border rounded-lg hover:bg-accent text-sm">Batal</button>
              <button type="submit" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">Simpan</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
