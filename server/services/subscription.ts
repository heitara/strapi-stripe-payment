import createHttpError from 'http-errors'
import { factories, Strapi } from '@strapi/strapi'
import {
  CreateCheckoutSessionParams,
  GetMySubscriptionParams,
  GetSubscriptionByIdParams,
  PauseSubscriptionParams,
  ResumeSubscriptionParams,
  UpdateSubscriptionParams,
  ResubscribeParams,
  CreateSessionParams
} from '../interfaces'
import { PlanType, SubscriptionStatus } from '../enums'
import { validateAndFetchCheckoutSessionDetails } from '../helpers'

export default factories.createCoreService('plugin::stripe-payment.subscription', ({ strapi }: { strapi: Strapi }) => ({
  async createCheckoutSession(params: CreateCheckoutSessionParams) {
    const { userId } = params
    const { organizationName, customerId, plan } = await validateAndFetchCheckoutSessionDetails(strapi, params)

    if (plan.type !== PlanType.RECURRING) {
      throw new createHttpError.BadRequest('Cannot create a subscription checkout session for a one-time plan')
    }

    const organizationByName = await strapi.query('plugin::stripe-payment.organization').findOne({
      where: { name: organizationName },
      populate: { subscription: true }
    })

    if (organizationByName?.subscription && organizationByName.subscription.status !== SubscriptionStatus.CANCELLED) {
      throw new createHttpError.BadRequest(
        `Cannot create a subscription for the organization '${organizationByName.name}' as it already has an active subscription`
      )
    }

    const successUrl: string = strapi.config.get('server.stripe.successPaymentUrl')
    const sessionParams: CreateSessionParams = {
      success_url: successUrl,
      metadata: { organizationName, userId, planId: plan.id, quantity: params.quantity },
      line_items: [{ price: plan.stripe_id, quantity: params.quantity }],
      subscription_data: { trial_period_days: 30 },
      mode: 'subscription',
      ...(customerId && { customer: customerId })
    }

    const session = await strapi.plugin('stripe-payment').service('stripe').checkout.sessions.create(sessionParams)
    return session.url
  },

  async getSubscriptionById(params: GetSubscriptionByIdParams) {
    const { id } = params

    const subscription = await strapi.query('plugin::stripe-payment.subscription').findOne({
      where: { id },
      populate: { organization: true, plan: true }
    })

    if (!subscription) {
      return null
    }

    const stripeSubscription = await strapi
      .plugin('stripe-payment')
      .service('stripe')
      .subscriptions.retrieve(subscription.stripe_id)

    return {
      ...subscription,
      quantity: stripeSubscription.quantity
    }
  },

  async getMySubscription(params: GetMySubscriptionParams) {
    const { userId } = params

    const organization = await strapi.query('plugin::stripe-payment.organization').findOne({
      where: { users: { id: userId } },
      populate: { users: true }
    })

    const subscription = await strapi.query('plugin::stripe-payment.subscription').findOne({
      where: { organization: { id: organization.id } },
      populate: ['organization', 'plan', 'plan.product']
    })

    const stripeSubscription = await strapi
      .plugin('stripe-payment')
      .service('stripe')
      .subscriptions.retrieve(subscription.stripe_id)

    return {
      ...subscription,
      quantity: stripeSubscription.quantity
    }
  },

  async getSubscriptions() {
    return strapi
      .query('plugin::stripe-payment.subscription')
      .findMany({ populate: { organization: true, plan: true } })
  },

  async cancelSubscription(params: PauseSubscriptionParams) {
    const { id } = params

    const subscription = await strapi.query('plugin::stripe-payment.subscription').findOne({
      where: { id },
      select: ['id', 'stripe_id', 'status']
    })

    if (!subscription) {
      return null
    }

    if (subscription.status === SubscriptionStatus.CANCELLED) {
      throw new createHttpError.Forbidden(`Subscription with ID ${id} already cancelled`)
    }

    await strapi.plugin('stripe-payment').service('stripe').subscriptions.cancel(subscription.stripe_id)

    await strapi.query('plugin::stripe-payment.subscription').update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.CANCELLED
      }
    })

    return true
  },

  async pauseSubscription(params: PauseSubscriptionParams) {
    const { id } = params

    const subscription = await strapi.query('plugin::stripe-payment.subscription').findOne({
      where: { id },
      select: ['id', 'stripe_id', 'status']
    })

    if (!subscription) {
      return null
    }

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new createHttpError.Forbidden(`Subscription with ID ${id} not in active state`)
    }

    await strapi
      .plugin('stripe-payment')
      .service('stripe')
      .subscriptions.update(subscription.stripe_id, {
        pause_collection: {
          behavior: 'void'
        }
      })

    const updatedSubscription = await strapi.query('plugin::stripe-payment.subscription').update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.PAUSED
      }
    })

    return updatedSubscription
  },

  async resumeSubscription(params: ResumeSubscriptionParams) {
    const { id } = params

    const subscription = await strapi.query('plugin::stripe-payment.subscription').findOne({
      where: { id },
      select: ['id', 'stripe_id', 'status']
    })

    if (!subscription) {
      return null
    }

    await strapi.plugin('stripe-payment').service('stripe').subscriptions.update(subscription.stripe_id, {
      pause_collection: null
    })

    if (subscription.status !== SubscriptionStatus.PAUSED) {
      throw new createHttpError.Forbidden(`Subscription with ID ${id} not in paused state`)
    }

    const updatedSubscription = await strapi.query('plugin::stripe-payment.subscription').update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.ACTIVE
      }
    })

    return updatedSubscription
  },

  async updateStripeSubscription(params: UpdateSubscriptionParams) {
    const { planId, quantity, id } = params

    const subscription = await strapi.query('plugin::stripe-payment.subscription').findOne({
      where: { id },
      populate: ['organization.users', 'plan']
    })

    if (!subscription) {
      throw new createHttpError.NotFound(`Subscription with ID ${id} not found`)
    }

    if (!subscription.organization) {
      throw new createHttpError.NotFound(`Organization with ID ${subscription.organization.id} not found`)
    }

    if (quantity && quantity < subscription.organization.users.length) {
      throw new createHttpError.BadRequest('Invalid quantity')
    }

    const stripeSubscription = await strapi
      .plugin('stripe-payment')
      .service('stripe')
      .subscriptions.retrieve(subscription.stripe_id)

    let stripeUpdatedPlan = subscription.plan.stripe_id
    let updatedPlan = subscription.plan
    const stripeUpdatedQuantity = quantity || stripeSubscription.items.data[0].quantity

    if (planId) {
      const plan = await strapi.query('plugin::stripe-payment.plan').findOne({
        where: { id: planId }
      })

      if (!plan) {
        throw new createHttpError.NotFound(`Plan with ID ${planId} not found`)
      }

      stripeUpdatedPlan = plan.stripe_id
      updatedPlan = plan
    } else {
      stripeUpdatedPlan = subscription.plan.stripe_id
    }

    if (stripeUpdatedQuantity > subscription.organization.quantity) {
      throw new createHttpError.BadRequest(
        'The new quantity exceeds the available seats in the organization. Please add more seats.'
      )
    }

    await strapi
      .plugin('stripe-payment')
      .service('stripe')
      .subscriptions.update(subscription.stripe_id, {
        items: [
          {
            id: stripeSubscription.items.data[0].id,
            price: stripeUpdatedPlan,
            quantity: stripeUpdatedQuantity
          }
        ]
      })

    const updatedSubscription = await strapi.query('plugin::stripe-payment.subscription').update({
      where: { id: subscription.id },
      data: {
        plan: updatedPlan
      }
    })

    return updatedSubscription
  },

  async resubscribe(params: ResubscribeParams) {
    const { id } = params

    const subscription = await strapi.query('plugin::stripe-payment.subscription').findOne({
      where: { id },
      populate: ['organization.users', 'plan']
    })

    if (!subscription) {
      throw new createHttpError.NotFound(`Subscription with ID ${id} not found`)
    }

    if (subscription.status !== SubscriptionStatus.CANCELLED) {
      throw new createHttpError.Forbidden(`subscription with ID ${id} is not cancelled`)
    }

    const quantity = subscription.organization.users.length

    const stripeSubscription = await strapi
      .plugin('stripe-payment')
      .service('stripe')
      .subscriptions.create({
        customer: subscription.organization.customer_id,
        items: [
          {
            price: subscription.plan.stripe_id,
            quantity
          }
        ]
      })

    await strapi.query('plugin::stripe-payment.subscription').update({
      where: {
        id: subscription.id
      },
      data: {
        stripe_id: stripeSubscription.id,
        status: SubscriptionStatus.ACTIVE
      }
    })

    return true
  }
}))
