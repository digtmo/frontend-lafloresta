import { CrmEventsProvider } from '@/components/admin/crm/CrmEventsContext'
import KanbanBoard from '@/components/admin/crm/KanbanBoard'

export default function CrmPage() {
  return (
    <CrmEventsProvider>
      <KanbanBoard />
    </CrmEventsProvider>
  )
}
