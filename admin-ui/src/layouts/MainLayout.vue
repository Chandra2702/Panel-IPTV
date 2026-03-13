<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import Navbar from '@/components/Navbar.vue'
import {
  LayoutDashboard,
  Users,
  List,
  UserCheck,
  Layers,
  Tags,
  Activity,
  Link,
  Settings,
  ChevronLeft,
  ChevronRight,
  RadioReceiver
} from 'lucide-vue-next'
import { apiCall } from '@/composables/useApi'

const route = useRoute()
const sidebarOpen = ref(true)
const isMobile = ref(false)
const userRole = ref('admin')

const allNavigation = [
  { name: 'Beranda', path: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'reseller'] },
  { name: 'Pengguna', path: '/users', icon: Users, roles: ['admin', 'reseller'] },
  { name: 'Saluran', path: '/channels', icon: List, roles: ['admin'] },
  { name: 'Live Stream', path: '/live-stream', icon: RadioReceiver, roles: ['admin'] },
  { name: 'Reseller', path: '/resellers', icon: UserCheck, roles: ['admin'] },
  { name: 'Paket Bouquet', path: '/bouquets', icon: Layers, roles: ['admin', 'reseller'] },
  { name: 'Kategori', path: '/categories', icon: Tags, roles: ['admin'] },
  { name: 'Monitor', path: '/monitor', icon: Activity, roles: ['admin'] },
  { name: 'Tautan Pendek', path: '/shortlinks', icon: Link, roles: ['admin', 'reseller'] },
  { name: 'Pengaturan', path: '/settings', icon: Settings, roles: ['admin'] },
]

const navigation = computed(() =>
  allNavigation.filter(item => item.roles.includes(userRole.value))
)

const checkMobile = () => {
  isMobile.value = window.innerWidth < 1024
  if (isMobile.value) {
    sidebarOpen.value = false
  } else {
    sidebarOpen.value = true
  }
}

const toggleSidebar = () => {
  sidebarOpen.value = !sidebarOpen.value
}

const closeSidebarOnMobile = () => {
  if (isMobile.value) {
    sidebarOpen.value = false
  }
}

onMounted(async () => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  try {
    const data = await apiCall('/api/auth/me')
    userRole.value = data.role || 'admin'
  } catch {}
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<template>
  <div class="flex h-screen bg-background">
    <div v-if="sidebarOpen && isMobile" @click="closeSidebarOnMobile" class="fixed inset-0 bg-black/50 z-40 lg:hidden">
    </div>

    <aside :class="[
      'bg-card border-r transition-all duration-300 flex flex-col fixed lg:relative h-full z-50 overflow-hidden',
      isMobile ? (sidebarOpen ? 'w-64' : 'w-0') : (sidebarOpen ? 'w-64' : 'w-16'),
      isMobile && !sidebarOpen ? '-translate-x-full' : 'translate-x-0'
    ]">
      <div class="p-4 border-b flex items-center justify-between">
        <h3 v-if="sidebarOpen" class="text-sm font-semibold flex items-center gap-2">
          <span class="text-primary">📺</span> IPTV Panel
        </h3>
        <button @click="toggleSidebar" class="p-2 hover:bg-accent rounded-md hidden lg:block"
          :class="{ 'mx-auto': !sidebarOpen }">
          <ChevronRight v-if="!sidebarOpen" :size="20" />
          <ChevronLeft v-else :size="20" />
        </button>
      </div>

      <nav class="flex-1 p-4 space-y-1 overflow-y-auto">
        <router-link v-for="item in navigation" :key="item.path" :to="item.path" @click="closeSidebarOnMobile" :class="[
          'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm',
          route.path === item.path
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-accent hover:text-accent-foreground'
        ]">
          <component :is="item.icon" :size="20" />
          <span v-if="sidebarOpen">{{ item.name }}</span>
        </router-link>
      </nav>
    </aside>

    <div class="flex-1 flex flex-col overflow-hidden">
      <Navbar :on-toggle-sidebar="toggleSidebar" />

      <main class="flex-1 overflow-auto">
        <div class="p-4 md:p-8">
          <RouterView />
        </div>
      </main>
    </div>
  </div>
</template>
