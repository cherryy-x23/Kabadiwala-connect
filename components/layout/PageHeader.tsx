import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  children?: ReactNode
  action?: ReactNode
}

export default function PageHeader({ title, description, children, action }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="container-app flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">{title}</h1>
          {description && <p className="text-gray-600 text-lg">{description}</p>}
          {children}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  )
}
