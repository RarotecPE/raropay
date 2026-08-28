'use client'

import { use } from 'react'
import ExpenseForm from '@/components/expense-form'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function EditExpensePage({ params }: PageProps) {
  const { id } = use(params)
  const expenseId = parseInt(id)
  
  return <ExpenseForm mode="edit" expenseId={expenseId} />
}
