'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { useAuth } from '@/components/auth-provider'
import { fuelTypeOptions, type Vehicle, type User } from '@/lib/types'
import { Plus, Car, Pencil, Trash2 } from 'lucide-react'
import { PaginationControl } from '@/components/pagination-control'

export default function VehiclesPage() {
  const { user } = useAuth()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // Paginação
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const totalPages = Math.ceil(vehicles.length / pageSize) || 1
  const paginatedVehicles = useMemo(() => {
    const start = (page - 1) * pageSize
    return vehicles.slice(start, start + pageSize)
  }, [vehicles, page, pageSize])
  
  // Form state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [plate, setPlate] = useState('')
  const [model, setModel] = useState('')
  const [brand, setBrand] = useState('')
  const [year, setYear] = useState('')
  const [fuelType, setFuelType] = useState('')
  const [kmPerLiter, setKmPerLiter] = useState('')
  const [ownerType, setOwnerType] = useState<'company' | 'employee' | 'third_party'>('company')
  const [ownerId, setOwnerId] = useState('')

  useEffect(() => {
    fetchVehicles()
    fetchUsers()
  }, [])

  async function fetchVehicles() {
    try {
      const response = await fetch('/api/vehicles')
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data)) setVehicles(data)
      }
    } catch (error) {
      console.error('Erro ao buscar veículos:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchUsers() {
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data)) setUsers(data)
      }
    } catch (error) {
      console.error('Erro ao buscar usuários:', error)
    }
  }

  function resetForm() {
    setEditingId(null)
    setPlate('')
    setModel('')
    setBrand('')
    setYear('')
    setFuelType('')
    setKmPerLiter('')
    setOwnerType('company')
    setOwnerId('')
  }

  function openEdit(vehicle: Vehicle) {
    setEditingId(vehicle.id)
    setPlate(vehicle.plate)
    setModel(vehicle.model)
    setBrand(vehicle.brand)
    setYear(vehicle.year?.toString() || '')
    setFuelType(vehicle.fuel_type || '')
    setKmPerLiter(vehicle.km_per_liter?.toString() || '')
    setOwnerType(vehicle.owner_type)
    setOwnerId(vehicle.owner_id?.toString() || '')
    setDialogOpen(true)
  }

  async function handleSubmit() {
    if (!plate || !model || !brand) {
      toast.error('Preencha placa, modelo e marca')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        plate: plate.toUpperCase(),
        model,
        brand,
        year: year ? parseInt(year) : null,
        fuel_type: fuelType || null,
        km_per_liter: kmPerLiter ? parseFloat(kmPerLiter) : null,
        owner_type: ownerType,
        owner_id: ownerId ? parseInt(ownerId) : null,
      }

      const url = editingId ? `/api/vehicles/${editingId}` : '/api/vehicles'
      const method = editingId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao salvar veículo')
      }

      toast.success(editingId ? 'Veículo atualizado!' : 'Veículo cadastrado!')
      setDialogOpen(false)
      resetForm()
      fetchVehicles()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar veículo')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Tem certeza que deseja excluir este veículo?')) return

    try {
      const response = await fetch(`/api/vehicles/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Erro ao excluir')
      toast.success('Veículo excluído!')
      fetchVehicles()
    } catch (error) {
      toast.error('Erro ao excluir veículo')
    }
  }

  const ownerTypeLabels = {
    company: 'Empresa',
    employee: 'Funcionário',
    third_party: 'Terceiro',
  }

  if (user?.role === 'employee') {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Veículos</h1>
          <p className="text-muted-foreground">Gerencie os veículos cadastrados</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Novo Veículo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Veículo' : 'Novo Veículo'}</DialogTitle>
              <DialogDescription>Preencha os dados do veículo</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Placa *</Label>
                  <Input placeholder="ABC-1234" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} />
                </div>
                <div className="space-y-2">
                  <Label>Ano</Label>
                  <Input type="number" placeholder="2024" value={year} onChange={(e) => setYear(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Marca *</Label>
                  <Input placeholder="Ex: Fiat" value={brand} onChange={(e) => setBrand(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Modelo *</Label>
                  <Input placeholder="Ex: Uno" value={model} onChange={(e) => setModel(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Combustível</Label>
                  <Select value={fuelType} onValueChange={setFuelType}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {fuelTypeOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>KM/L Esperado</Label>
                  <Input type="number" step="0.1" placeholder="Ex: 12" value={kmPerLiter} onChange={(e) => setKmPerLiter(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Proprietário</Label>
                  <Select value={ownerType} onValueChange={(v) => setOwnerType(v as typeof ownerType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="company">Empresa</SelectItem>
                      <SelectItem value="employee">Funcionário</SelectItem>
                      <SelectItem value="third_party">Terceiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {ownerType === 'employee' && (
                  <div className="space-y-2">
                    <Label>Funcionário</Label>
                    <Select value={ownerId} onValueChange={setOwnerId}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Spinner className="mr-2" />}
                {editingId ? 'Salvar' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="w-5 h-5" />
            Veículos Cadastrados
          </CardTitle>
          <CardDescription>{vehicles.length} veículo(s) encontrado(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : vehicles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum veículo cadastrado
            </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Placa</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Combustível</TableHead>
                  <TableHead>KM/L</TableHead>
                  <TableHead>Proprietário</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedVehicles.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono font-medium">{v.plate}</TableCell>
                    <TableCell>
                      {v.brand} {v.model} {v.year && `(${v.year})`}
                    </TableCell>
                    <TableCell>
                      {v.fuel_type ? fuelTypeOptions.find(o => o.value === v.fuel_type)?.label || v.fuel_type : '-'}
                    </TableCell>
                    <TableCell>{v.km_per_liter ? `${v.km_per_liter} km/l` : '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ownerTypeLabels[v.owner_type]}
                      </Badge>
                      {v.owner_name && <span className="ml-2 text-sm text-muted-foreground">{v.owner_name}</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(v)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(v.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="mt-4">
                <PaginationControl
                  currentPage={page}
                  pageSize={pageSize}
                  totalPages={totalPages}
                  totalCount={vehicles.length}
                  onPageChange={setPage}
                  onPageSizeChange={(newSize) => {
                    setPageSize(newSize)
                    setPage(1)
                  }}
                  pageSizeOptions={[20, 50, 100]}
                />
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
