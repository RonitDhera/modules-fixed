import { model } from "@medusajs/framework/utils"

const Supplier = model.define("supplier", {
  id: model.id().primaryKey(),
  name: model.text(),
  email: model.text().nullable(),
  phone: model.text().nullable(),
  address: model.text().nullable(),
  currency_code: model.text(),
  notes: model.text().nullable(),
})

export default Supplier