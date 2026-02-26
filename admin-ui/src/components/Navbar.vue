<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Menu, User, LogOut, Coins } from 'lucide-vue-next'
import { apiCall, logout, formatRupiah } from '@/composables/useApi'

defineProps<{
  onToggleSidebar: () => void
}>()

const adminName = ref('Admin')
const adminRole = ref('admin')
const adminCredits = ref(0)

onMounted(async () => {
  try {
    const data = await apiCall('/api/auth/me')
    if (data.username) adminName.value = data.username
    if (data.role) adminRole.value = data.role
    if (data.credits !== undefined) adminCredits.value = data.credits
  } catch {}
})
</script>

<template>
  <nav class="bg-card border-b sticky top-0 z-40">
    <div class="px-4 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center gap-4">
          <button
            @click="onToggleSidebar"
            class="lg:hidden p-2 hover:bg-accent rounded-md"
            aria-label="Toggle menu"
          >
            <Menu :size="20" />
          </button>
          <h2 class="text-lg font-semibold hidden md:block">IPTV Panel Admin</h2>
        </div>

        <div class="flex items-center gap-3">
          <div v-if="adminRole === 'reseller'" class="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium">
            <Coins :size="16" />
            <span>{{ adminCredits }} Token</span>
          </div>
          <div class="flex items-center gap-2 px-3 py-2">
            <div class="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
              <User :size="18" />
            </div>
            <span class="hidden sm:block text-sm font-medium">{{ adminName }}</span>
          </div>
          <button
            @click="logout()"
            class="p-2 hover:bg-red-50 rounded-md text-red-500"
            title="Keluar"
          >
            <LogOut :size="18" />
          </button>
        </div>
      </div>
    </div>
  </nav>
</template>
