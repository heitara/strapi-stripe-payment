/**
 *  controller
 */

import { factories, Strapi } from '@strapi/strapi'
import createHttpError from 'http-errors'
import { CreateCheckoutSessionParams } from '../interfaces'
import { validateWithYupSchema } from '../helpers'
import { createCheckoutSessionSchema } from '../validationSchemas'

export default factories.createCoreController('plugin::stripe-payment.purchase', ({ strapi }: { strapi: Strapi }) => ({
  async createCheckoutSession(ctx) {
    const { quantity, planId, organizationName, organizationId } = ctx.request.body as Omit<
      CreateCheckoutSessionParams,
      'userId'
    >
    const { user } = ctx.state

    const validatedParams = await validateWithYupSchema(createCheckoutSessionSchema, {
      quantity,
      planId,
      organizationName,
      organizationId
    })

    const checkoutSessionLink = await strapi
      .plugin('stripe-payment')
      .service('purchase')
      .createCheckoutSession({
        userId: user.id,
        ...validatedParams
      })

    ctx.send({ url: checkoutSessionLink })
  },

  async getAllPurchases(ctx) {
    const { id } = ctx.params

    const purchases = await strapi.plugin('stripe-payment').service('purchase').getAllPurchases({
      organizationId: id
    })

    if (!purchases) {
      throw new createHttpError.NotFound(`Purchases are not found`)
    }

    ctx.send(purchases)
  }
}))
