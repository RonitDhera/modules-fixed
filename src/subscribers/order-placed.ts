import { 
  SubscriberArgs, 
  type SubscriberConfig 
} from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  logger.info(`[Analytics] Order placed event received for order id: ${data.id}`)

  // Here we will add logic to increment daily counters or update snapshots in real-time
}

export const config: SubscriberConfig = {
  event: "order.placed",
}