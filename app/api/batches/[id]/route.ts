import { NextRequest, NextResponse } from "next/server"
import { getSession, canViewAllExpenses } from "@/lib/auth"
import { sql } from "@/lib/db"

// GET - Buscar remessa por ID com suas despesas
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { id } = await params

    // Buscar a remessa
    const [batch] = await sql`
      SELECT 
        b.*,
        COALESCE(
          (SELECT SUM(e.amount) FROM expenses e WHERE e.batch_id = b.id),
          b.total_amount,
          0
        ) as total_amount,
        u.name as user_name,
        u.email as user_email
      FROM expense_batches b
      JOIN users u ON b.user_id = u.id
      WHERE b.id = ${parseInt(id)}
    `

    if (!batch) {
      return NextResponse.json({ error: "Remessa não encontrada" }, { status: 404 })
    }

    // Verificar permissão: usuário comum só pode ver suas próprias remessas
    if (!canViewAllExpenses(session.role) && batch.user_id !== session.id) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    // Buscar as despesas da remessa com nome do solicitante
    const expenses = await sql`
      SELECT e.*, r.name as requester_name
      FROM expenses e
      LEFT JOIN users r ON e.requester IS NOT NULL AND e.requester ~ '^[0-9]+$' AND r.id = CAST(e.requester AS INTEGER)
      WHERE e.batch_id = ${parseInt(id)} 
      ORDER BY e.expense_date DESC
    `

    return NextResponse.json({ ...batch, expenses })
  } catch (error) {
    console.error("Erro ao buscar remessa:", error)
    return NextResponse.json({ error: "Erro ao buscar remessa" }, { status: 500 })
  }
}

// PATCH - Atualizar status da remessa (aprovar/rejeitar)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Apenas admin/financeiro podem aprovar/rejeitar remessas
    if (!canViewAllExpenses(session.role)) {
      return NextResponse.json({ error: 'Sem permissão para aprovar/rejeitar remessas' }, { status: 403 })
    }

    const { id } = await params
    const batchId = parseInt(id)
    const body = await request.json()
    const { status, rejection_reason, reviewed_by, expense_ids_for_correction, observations, finance_observations } = body

    const [beforeBatch] = await sql`
      SELECT b.*, u.name as user_name, u.email as user_email
      FROM expense_batches b
      JOIN users u ON b.user_id = u.id
      WHERE b.id = ${batchId}
    `
    if (!beforeBatch) {
      return NextResponse.json({ error: "Remessa não encontrada" }, { status: 404 })
    }
    const ownerName = String(beforeBatch.user_name || `Usuário #${beforeBatch.user_id}`)
    const { auditClient, getRequestContext } = await import("@/lib/audit")

    // Se for apenas edição de observações (sem status)
    if (!status && (observations !== undefined || finance_observations !== undefined)) {
      const isAdmin = session.role === 'admin' || session.role === 'director'
      if (!isAdmin) {
        return NextResponse.json({ error: 'Apenas administradores podem editar observações' }, { status: 403 })
      }

      const [updated] = await sql`
        UPDATE expense_batches
        SET 
          observations = COALESCE(${observations}, observations),
          finance_observations = COALESCE(${finance_observations}, finance_observations),
          updated_at = NOW()
        WHERE id = ${batchId}
        RETURNING *
      `

      auditClient.log({
        category: "finance",
        action: "batch.updated",
        severity: "INFO",
        actor: {
          type: "user",
          userId: String(session.id),
          name: session.name,
          email: session.email,
          role: session.role,
        },
        targets: [
          { type: "batch", id: String(batchId), label: `Remessa #${batchId} - ${ownerName}` },
          { type: "user", id: String(beforeBatch.user_id), label: ownerName },
        ],
        context: getRequestContext(request),
        diff: {
          before: {
            observations: beforeBatch.observations ?? null,
            finance_observations: beforeBatch.finance_observations ?? null,
          },
          after: {
            observations: updated.observations ?? null,
            finance_observations: updated.finance_observations ?? null,
          },
        },
        details: {
          batch_id: batchId,
          user_id: beforeBatch.user_id,
          user_name: ownerName,
          observations: updated.observations ?? null,
          finance_observations: updated.finance_observations ?? null,
        },
      })

      return NextResponse.json(updated)
    }

    if (!status) {
      return NextResponse.json({ error: "Status é obrigatório" }, { status: 400 })
    }

    // Para correção parcial, verificamos quantas despesas restam na remessa
    let batchStatus = status
    let batch

    if (status === 'correction' && expense_ids_for_correction && expense_ids_for_correction.length > 0) {
      // Contar total de despesas na remessa
      const [countResult] = await sql`
        SELECT COUNT(*) as total FROM expenses WHERE batch_id = ${batchId}
      `
      const totalExpenses = parseInt(countResult.total)
      
      // Se for correção parcial (não são todas as despesas), manter remessa como 'pending'
      // para que as outras despesas continuem em análise
      if (expense_ids_for_correction.length < totalExpenses) {
        batchStatus = 'pending' // Mantém a remessa em análise
      }
    }

    // Atualizar a remessa
    [batch] = await sql`
      UPDATE expense_batches 
      SET 
        status = ${batchStatus},
        rejection_reason = ${rejection_reason || null},
        reviewed_by = ${reviewed_by || null},
        reviewed_at = NOW(),
        updated_at = NOW()
      WHERE id = ${batchId}
      RETURNING *
    `

    // Se aprovado, atualizar apenas as despesas que estão na remessa para approved
    if (status === 'approved') {
      await sql`
        UPDATE expenses 
        SET 
          status = 'approved', 
          reviewed_by = ${reviewed_by || null},
          reviewed_at = NOW(),
          updated_at = NOW()
        WHERE batch_id = ${batchId} AND status NOT IN ('rejected', 'correction')
      `
    }

    // Se rejeitado, atualizar despesas que ainda não foram aprovadas para rejected
    // Despesas SAEM da remessa (batch_id = NULL) - só aparecem no histórico
    if (status === 'rejected') {
      await sql`
        UPDATE expenses 
        SET 
          status = 'rejected',
          rejection_reason = ${rejection_reason || null},
          reviewed_by = ${reviewed_by || null},
          reviewed_at = NOW(),
          updated_at = NOW(),
          original_batch_id = COALESCE(original_batch_id, batch_id),
          batch_id = NULL
        WHERE batch_id = ${batchId} AND status NOT IN ('approved')
      `
      
      // Verificar se restam despesas aprovadas na remessa
      const [remaining] = await sql`
        SELECT COUNT(*) as count FROM expenses WHERE batch_id = ${batchId}
      `
      
      if (parseInt(remaining.count) === 0) {
        // Não restam despesas - cancelar remessa
        const [cancelledBatch] = await sql`
          UPDATE expense_batches SET status = 'cancelled', updated_at = NOW()
          WHERE id = ${batchId}
          RETURNING *
        `
        if (cancelledBatch) {
          batch = cancelledBatch
        }
      }
    }

    // Se precisa correção, atualizar despesas selecionadas para correction
    // Despesas PERMANECEM na remessa - apenas mudam de status
    if (status === 'correction') {
      if (expense_ids_for_correction && expense_ids_for_correction.length > 0) {
        for (const expenseId of expense_ids_for_correction) {
          await sql`
            UPDATE expenses 
            SET 
              status = 'correction',
              rejection_reason = ${rejection_reason || null},
              updated_at = NOW(),
              original_batch_id = COALESCE(original_batch_id, batch_id)
            WHERE id = ${expenseId} AND batch_id = ${batchId}
          `
        }
      } else {
        await sql`
          UPDATE expenses 
          SET 
            status = 'correction',
            rejection_reason = ${rejection_reason || null},
            updated_at = NOW(),
            original_batch_id = COALESCE(original_batch_id, batch_id)
          WHERE batch_id = ${batchId} AND status IN ('pending', 'submitted')
        `
      }
    }

    const actionMap: Record<string, string> = {
      approved: "batch.approved",
      rejected: "batch.rejected",
      correction: "batch.correction_requested",
    }

    auditClient.log({
      category: "finance",
      action: actionMap[status] || "batch.updated",
      severity: status === "rejected" || status === "correction" ? "WARNING" : "INFO",
      actor: {
        type: "user",
        userId: String(session.id),
        name: session.name,
        email: session.email,
        role: session.role,
      },
      targets: [
        {
          type: "batch",
          id: String(batchId),
          label: `Remessa #${batchId} - ${ownerName} (R$ ${Number(beforeBatch.total_amount || 0).toFixed(2)})`,
        },
        {
          type: "user",
          id: String(beforeBatch.user_id),
          label: ownerName,
        },
      ],
      context: getRequestContext(request),
      diff: {
        before: {
          status: beforeBatch.status,
          rejection_reason: beforeBatch.rejection_reason ?? null,
        },
        after: {
          status: batch.status,
          rejection_reason: batch.rejection_reason ?? null,
        },
      },
      details: {
        batch_id: batchId,
        user_id: beforeBatch.user_id,
        user_name: ownerName,
        settlement_type: beforeBatch.settlement_type,
        total_amount: Number(beforeBatch.total_amount || 0),
        previous_status: beforeBatch.status,
        new_status: batch.status,
        requested_action_status: status,
        rejection_reason: rejection_reason || null,
        expense_ids_for_correction: expense_ids_for_correction || null,
      },
    })

    return NextResponse.json(batch)
  } catch (error) {
    console.error("Erro ao atualizar remessa:", error)
    return NextResponse.json({ error: "Erro ao atualizar remessa" }, { status: 500 })
  }
}
