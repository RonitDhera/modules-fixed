import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import { PURCHASE_ORDER_MODULE } from "../../modules/purchase-order"
import PurchaseOrderModuleService from "../../modules/purchase-order/service"
import { SupplierDTO } from "../../modules/purchase-order/types"

export type CreateSupplierInput = {
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  currency_code: string
  notes?: string | null
}

export type UpdateSupplierInput = Partial<CreateSupplierInput> & {
  id: string
}

const createSupplierStep = createStep(
  "create-supplier-step",
  async (input: CreateSupplierInput, { container }) => {
    const purchaseOrderService: PurchaseOrderModuleService =
      container.resolve(PURCHASE_ORDER_MODULE)

    const supplier = (await purchaseOrderService.createSuppliers({
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      currency_code: input.currency_code,
      notes: input.notes ?? null,
    })) as unknown as SupplierDTO

    return new StepResponse(supplier, supplier.id)
  },
  async (supplierId: string | undefined, { container }) => {
    if (!supplierId) {
      return
    }

    const purchaseOrderService: PurchaseOrderModuleService =
      container.resolve(PURCHASE_ORDER_MODULE)

    await purchaseOrderService.deleteSuppliers([supplierId])
  }
)

const updateSupplierStep = createStep(
  "update-supplier-step",
  async (input: UpdateSupplierInput, { container }) => {
    const purchaseOrderService: PurchaseOrderModuleService =
      container.resolve(PURCHASE_ORDER_MODULE)

    const existing = (await purchaseOrderService.retrieveSupplier(
      input.id
    )) as unknown as SupplierDTO

    const { id, ...changes } = input

    await purchaseOrderService.updateSuppliers({ id, ...changes })

    const updated = (await purchaseOrderService.retrieveSupplier(
      id
    )) as unknown as SupplierDTO

    return new StepResponse(updated, {
      id: existing.id,
      name: existing.name,
      email: existing.email,
      phone: existing.phone,
      address: existing.address,
      currency_code: existing.currency_code,
      notes: existing.notes,
    })
  },
  async (previous: Partial<SupplierDTO> & { id?: string } | undefined, { container }) => {
    if (!previous?.id) {
      return
    }

    const purchaseOrderService: PurchaseOrderModuleService =
      container.resolve(PURCHASE_ORDER_MODULE)

    await purchaseOrderService.updateSuppliers({
      id: previous.id,
      name: previous.name,
      email: previous.email,
      phone: previous.phone,
      address: previous.address,
      currency_code: previous.currency_code,
      notes: previous.notes,
    })
  }
)

export const createSupplierWorkflow = createWorkflow(
  "create-supplier",
  (input: CreateSupplierInput) => {
    const supplier = createSupplierStep(input)

    return new WorkflowResponse(supplier)
  }
)

export const updateSupplierWorkflow = createWorkflow(
  "update-supplier",
  (input: UpdateSupplierInput) => {
    const supplier = updateSupplierStep(input)

    return new WorkflowResponse(supplier)
  }
)
