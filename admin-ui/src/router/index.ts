import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'

const router = createRouter({
  history: createWebHistory('/admin/'),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/LoginView.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/',
      component: MainLayout,
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: '/dashboard' },
        { path: 'dashboard', name: 'Dashboard', component: () => import('@/views/DashboardView.vue') },
        { path: 'users', name: 'Users', component: () => import('@/views/UsersView.vue') },
        { path: 'channels', name: 'Channels', component: () => import('@/views/ChannelsView.vue') },
        { path: 'resellers', name: 'Resellers', component: () => import('@/views/ResellersView.vue') },
        { path: 'bouquets', name: 'Bouquets', component: () => import('@/views/BouquetsView.vue') },
        { path: 'categories', name: 'Categories', component: () => import('@/views/CategoriesView.vue') },
        { path: 'monitor', name: 'Monitor', component: () => import('@/views/MonitorView.vue') },
        { path: 'shortlinks', name: 'Shortlinks', component: () => import('@/views/ShortlinksView.vue') },
        { path: 'settings', name: 'Settings', component: () => import('@/views/SettingsView.vue') },
      ]
    }
  ]
})

// Auth guard
router.beforeEach(async (to) => {
  if (to.meta.requiresAuth === false) return true

  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' })
    if (!res.ok) return { name: 'Login' }
  } catch {
    return { name: 'Login' }
  }
  return true
})

export default router
