import { Strapi } from '@strapi/strapi'
import createHttpError from 'http-errors'
import { CreateCheckoutSessionParams } from '../interfaces'

export async function validateAndFetchCheckoutSessionDetails(
  strapi: Strapi,
  params: Omit<CreateCheckoutSessionParams, 'userId'>
) {
  const { planId, quantity, organizationId } = params

  let organizationName: string
  let customerId: string | undefined

  if (params.organizationName) {
    const organizationExisting = await strapi.query('plugin::stripe-payment.organization').count({
      where: {
        name: params.organizationName
      }
    })

    if (organizationExisting) {
      throw new createHttpError.BadRequest(`Organization with name ${params.organizationName} already exists`)
    }

    organizationName = params.organizationName
  } else {
    const organizationById = await strapi.query('plugin::stripe-payment.organization').findOne({
      where: { id: organizationId },
      populate: { users: true, subscription: true }
    })

    if (!organizationById) {
      throw new createHttpError.NotFound(`Organization with id ${organizationId} not found`)
    }
    if (quantity < organizationById.users.length) {
      throw new createHttpError.BadRequest('Quantity cannot be less than the number of users in the organization')
    }
    if (quantity > organizationById.quantity) {
      throw new createHttpError.BadRequest(
        "Quantity exceeds the organization's limit. Please increase the number of seats first."
      )
    }

    customerId = organizationById.customer_id
    organizationName = organizationById.name
  }

  const plan = await strapi.query('plugin::stripe-payment.plan').findOne({
    where: { id: planId }
  })

  if (!plan) {
    throw new createHttpError.NotFound('Plan not found')
  }

  return { organizationName, customerId, plan }
}
