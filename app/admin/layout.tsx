import AppShell from '@/components/AppShell'
import AdminSubnav from '@/components/AdminSubnav'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AppShell><AdminSubnav />{children}</AppShell>
}
