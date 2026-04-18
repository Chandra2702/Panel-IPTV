<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardTitle from '@/components/ui/CardTitle.vue'
import CardContent from '@/components/ui/CardContent.vue'
import { Settings, Save, Download, Upload, AlertTriangle, Video } from 'lucide-vue-next'
import { apiCall } from '@/composables/useApi'

const settings = ref<any>({})
const loading = ref(true)
const saving = ref(false)
const backingUp = ref(false)
const restoring = ref(false)
const restoreFile = ref<File | null>(null)
const uploadingVideos = ref<any>({})
const videoFiles = ref<any>({})

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

async function downloadBackup() {
  backingUp.value = true
  try {
    const response = await fetch('/api/admin/settings/backup', {
      credentials: 'include'
    })
    if (!response.ok) throw new Error('Backup gagal')
    
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `iptv-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    
    alert('✅ Backup berhasil didownload!')
  } catch (err: any) {
    alert('❌ ' + (err.message || 'Backup gagal'))
  } finally {
    backingUp.value = false
  }
}

function onFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    restoreFile.value = input.files[0]
  }
}

async function restoreBackup() {
  if (!restoreFile.value) {
    alert('Pilih file backup terlebih dahulu')
    return
  }

  if (!confirm('⚠️ PERINGATAN!\n\nRestore akan MENGGANTI SEMUA DATA yang ada saat ini dengan data dari file backup.\n\nData yang ada sekarang akan HILANG.\n\nLanjutkan?')) {
    return
  }

  restoring.value = true
  try {
    const formData = new FormData()
    formData.append('backup', restoreFile.value)

    const response = await fetch('/api/admin/settings/restore', {
      method: 'POST',
      credentials: 'include',
      body: formData
    })

    const result = await response.json()
    
    if (!response.ok) {
      throw new Error(result.error || 'Restore gagal')
    }

    alert('✅ ' + result.message)
    restoreFile.value = null
    // Reload page to reflect restored data
    window.location.reload()
  } catch (err: any) {
    alert('❌ ' + (err.message || 'Restore gagal'))
  } finally {
    restoring.value = false
  }
}

function onVideoSelect(e: Event, type: string) {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    if (input.files[0].type !== 'video/mp4') {
        alert('Hanya format MP4 yang didukung')
        input.value = ''
        return
    }
    videoFiles.value[type] = input.files[0]
  }
}

async function uploadVideo(type: string) {
  const file = videoFiles.value[type]
  if (!file) {
    alert('Pilih file mp4 terlebih dahulu')
    return
  }
  uploadingVideos.value[type] = true
  try {
    const formData = new FormData()
    formData.append('video', file)

    const response = await fetch(`/api/admin/settings/upload-video/${type}`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    })

    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Upload gagal')

    alert('✅ ' + result.message)
    videoFiles.value[type] = null
  } catch (err: any) {
    alert('❌ ' + (err.message || 'Upload gagal'))
  } finally {
    uploadingVideos.value[type] = false
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
      

      <div class="flex justify-end">
        <button type="submit" :disabled="saving" class="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50">
          <Save :size="16" />
          {{ saving ? 'Menyimpan...' : 'Simpan Pengaturan' }}
        </button>
      </div>
    </form>

    <!-- Backup & Restore Section -->
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2 text-base">
          <Settings :size="18" />
          Backup & Restore
        </CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <!-- Backup -->
        <div class="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <h3 class="font-medium">Backup Database</h3>
            <p class="text-sm text-muted-foreground">Download seluruh data sebagai file JSON</p>
          </div>
          <button 
            @click="downloadBackup" 
            :disabled="backingUp"
            class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Download :size="16" />
            {{ backingUp ? 'Mengunduh...' : 'Download Backup' }}
          </button>
        </div>

        <!-- Restore -->
        <div class="p-4 border rounded-lg space-y-3">
          <div>
            <h3 class="font-medium">Restore Database</h3>
            <p class="text-sm text-muted-foreground">Upload file backup JSON untuk mengembalikan data</p>
          </div>
          
          <div class="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
            <AlertTriangle :size="16" class="flex-shrink-0" />
            <span>Restore akan <strong>mengganti semua data</strong> yang ada saat ini. Pastikan Anda sudah backup terlebih dahulu.</span>
          </div>

          <div class="flex items-center gap-3">
            <input 
              type="file" 
              accept=".json" 
              @change="onFileSelect"
              class="flex-1 text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-secondary file:text-secondary-foreground file:cursor-pointer hover:file:opacity-80"
            />
            <button 
              @click="restoreBackup" 
              :disabled="restoring || !restoreFile"
              class="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              <Upload :size="16" />
              {{ restoring ? 'Merestore...' : 'Restore' }}
            </button>
          </div>
          <p v-if="restoreFile" class="text-xs text-muted-foreground">
            File: {{ restoreFile.name }} ({{ (restoreFile.size / 1024).toFixed(1) }} KB)
          </p>
        </div>
      </CardContent>
    </Card>

    <!-- Video Setup Section -->
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2 text-base">
          <Video :size="18" />
          Video Peringatan (.mp4)
        </CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        
        <!-- Blocked Video -->
        <div class="p-4 border rounded-lg space-y-3 bg-red-50/50">
          <div>
            <h3 class="font-medium text-red-800">Video Akun Diblokir (blocked.mp4)</h3>
            <p class="text-sm text-muted-foreground">Otomatis diputar saat pelanggan mencoba menonton tetapi status akunnya sedang Diblokir</p>
          </div>
          <div class="flex items-center gap-3">
            <input type="file" accept="video/mp4" @change="onVideoSelect($event, 'blocked')" class="flex-1 text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-secondary file:cursor-pointer hover:file:opacity-80" />
            <button @click="uploadVideo('blocked')" :disabled="uploadingVideos['blocked'] || !videoFiles['blocked']" class="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
              <Upload :size="16" /> {{ uploadingVideos['blocked'] ? 'Mengunggah...' : 'Upload Video' }}
            </button>
          </div>
        </div>

        <!-- Expired Video -->
        <div class="p-4 border rounded-lg space-y-3 bg-amber-50/50">
          <div>
            <h3 class="font-medium text-amber-800">Video Kedaluwarsa (expired.mp4)</h3>
            <p class="text-sm text-muted-foreground">Otomatis diputar saat durasi masa aktif pelanggan telah habis/expired</p>
          </div>
          <div class="flex items-center gap-3">
            <input type="file" accept="video/mp4" @change="onVideoSelect($event, 'expired')" class="flex-1 text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-secondary file:cursor-pointer hover:file:opacity-80" />
            <button @click="uploadVideo('expired')" :disabled="uploadingVideos['expired'] || !videoFiles['expired']" class="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors">
              <Upload :size="16" /> {{ uploadingVideos['expired'] ? 'Mengunggah...' : 'Upload Video' }}
            </button>
          </div>
        </div>

        <!-- Full Connections Video -->
        <div class="p-4 border rounded-lg space-y-3 bg-blue-50/50">
          <div>
            <h3 class="font-medium text-blue-800">Video Maks Koneksi / Perangkat Penuh (full.mp4)</h3>
            <p class="text-sm text-muted-foreground">Otomatis diputar saat pelanggan mencoba login di perangkat baru tetapi slot maks perangkat penuh</p>
          </div>
          <div class="flex items-center gap-3">
            <input type="file" accept="video/mp4" @change="onVideoSelect($event, 'full')" class="flex-1 text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-secondary file:cursor-pointer hover:file:opacity-80" />
            <button @click="uploadVideo('full')" :disabled="uploadingVideos['full'] || !videoFiles['full']" class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              <Upload :size="16" /> {{ uploadingVideos['full'] ? 'Mengunggah...' : 'Upload Video' }}
            </button>
          </div>
        </div>

      </CardContent>
    </Card>

  </div>
</template>
