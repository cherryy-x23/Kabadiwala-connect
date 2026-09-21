import KabadiwalaApp from '@/components/KabadiwalaApp'
import { WorkflowProvider } from '@/components/shared/WorkflowContext'

export default function CatchAllPage() {
  return <WorkflowProvider><KabadiwalaApp /></WorkflowProvider>
}

export const dynamic = 'force-dynamic'
