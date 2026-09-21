'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { mockNotifications, mockRequests, mockTransactions, mockRecyclers, mockCollectors, type WasteRequest, type Transaction, type Notification } from '@/data/mockData'

type WorkflowStatus = WasteRequest['status'] | 'scheduled'
export type WorkflowRequest = Omit<WasteRequest, 'status'> & { status: WorkflowStatus; completedAt?: string }

type WorkflowContextValue = { requests: WorkflowRequest[]; transactions: Transaction[]; notifications: Notification[]; createRequest: (input: Omit<WorkflowRequest, 'id'|'status'|'createdDate'>) => WorkflowRequest; updateRequest: (id: string, status: WorkflowStatus) => void; getRequest: (id: string) => WorkflowRequest | undefined }
const WorkflowContext = createContext<WorkflowContextValue | null>(null)

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState<WorkflowRequest[]>(mockRequests as WorkflowRequest[])
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions)
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications)
  const updateRequest = (id: string, status: WorkflowStatus) => {
    setRequests(current => current.map(request => request.id === id ? { ...request, status, ...(status === 'completed' ? { completedAt: new Date().toISOString() } : {}) } : request))
    const request = requests.find(item => item.id === id)
    if (!request) return
    const recycler = mockRecyclers.find(item => item.id === request.recyclerId)
    const message = status === 'accepted' ? `${recycler?.name} accepted your handover request.` : status === 'scheduled' ? 'Your handover has been scheduled.' : status === 'in-transit' ? 'Your handover is in transit.' : status === 'completed' ? 'Handover completed successfully. Your transaction has been recorded.' : 'Your handover request was rejected.'
    setNotifications(current => [{ id: `note_${Date.now()}`, userId: request.collectorId, type: status === 'completed' ? 'payment' : 'request', title: 'Handover update', message, read: false, createdAt: new Date().toISOString(), actionUrl: `/collector/requests/${id}` }, ...current])
    if (status === 'completed' && !transactions.some(item => item.requestId === id)) {
      const collector = mockCollectors.find(item => item.id === request.collectorId)
      setTransactions(current => [{ id: `txn_${Date.now()}`, requestId: id, collectorName: collector?.name ?? 'Ravi Kumar', recyclerName: recycler?.name ?? 'Recycler', material: request.material, weight: request.weight, amount: request.estimatedValue, status: 'completed', date: new Date().toISOString().slice(0, 10) }, ...current])
    }
  }
  const value = useMemo(() => ({ requests, transactions, notifications, createRequest: (input: Omit<WorkflowRequest, 'id'|'status'|'createdDate'>) => { const request = { ...input, id: `req_${Date.now()}`, status: 'pending' as WorkflowStatus, createdDate: new Date().toISOString().slice(0, 10) }; setRequests(current => [request, ...current]); setNotifications(current => [{ id: `note_${Date.now()}`, userId: request.collectorId, type: 'request', title: 'Request sent', message: `Your handover request has been sent to ${mockRecyclers.find(item => item.id === request.recyclerId)?.name}.`, read: false, createdAt: new Date().toISOString() }, ...current]); return request }, updateRequest, getRequest: (id: string) => requests.find(request => request.id === id) }), [requests, transactions, notifications])
  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>
}
export function useWorkflow() { const context = useContext(WorkflowContext); if (!context) throw new Error('useWorkflow must be used inside WorkflowProvider'); return context }
export { mockRecyclers }
