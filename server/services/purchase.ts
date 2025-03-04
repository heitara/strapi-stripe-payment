import createHttpError from 'http-errors'
import { factories, Strapi } from '@strapi/strapi'
import { CreateCheckoutSessionParams, CreateSessionParams, GetAllPurchasesParams } from '../interfaces'
import { validateAndFetchCheckoutSessionDetails } from '../helpers'
import { PlanType } from '../enums'

export default factories.createCoreService('plugin::stripe-payment.purchase', ({ strapi }: { strapi: Strapi }) => ({
  async createCheckoutSession(params: CreateCheckoutSessionParams) {
    const { userId } = params
    const { organizationName, customerId, plan } = await validateAndFetchCheckoutSessionDetails(strapi, params)

    if (plan.type !== PlanType.ONE_TIME) {
      throw new createHttpError.BadRequest('Cannot create purchase for a one-time plan')
    }

    const successUrl: string = strapi.config.get('server.stripe.successPaymentUrl')
    const sessionParams: CreateSessionParams = {
      success_url: successUrl,
      metadata: { organizationName, userId, planId: plan.id, quantity: 1 },
      line_items: [{ price: plan.stripe_id, quantity: 1 }],
      mode: 'payment',
      ...(customerId && { customer: customerId })
    }

    const session = await strapi.plugin('stripe-payment').service('stripe').checkout.sessions.create(sessionParams)
    return session.url
  },

  async getAllTransactions(params: GetAllPurchasesParams) {
    const { organizationId } = params

    const organization = await strapi.query('plugin::stripe-payment.organization').findOne({
      where: {
        id: organizationId
      },
      populate: {
        transactions: true
      }
    })

    if (!organization) {
      return null
    }

    return strapi.query('plugin::stripe-payment.purchase').findMany({
      where: {
        organization: organization.id
      },
      populate: {
        plan: true
      }
    })
  }
}))
