import purchaseService from '../../server/services/purchase'
import { Strapi } from '@strapi/strapi'
import { createMockStrapi } from '../factories'
import { strapiPurchaseServiceMock } from '../mocks'
import { PlanType } from '../../server/enums'

jest.mock('stripe')

describe('Purchase Service', () => {
  let strapi: Strapi

  beforeEach(() => {
    strapi = createMockStrapi(strapiPurchaseServiceMock)
  })

  describe('Create Checkout Session', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })
    it.each([
      {
        name: 'should create a checkout session for a new organization',
        serviceMethodArgs: {
          organizationName: 'Test Organization',
          userId: 1,
          planId: 1,
          quantity: 1
        },
        expectedResult: 'https://checkout.session.url',
        setupMocks: () => {
          jest.spyOn(strapi.query('plugin::stripe-payment.plan'), 'findOne').mockResolvedValue({
            id: 1,
            stripe_id: 'price_123',
            type: PlanType.ONE_TIME
          })
          jest.spyOn(strapi.query('plugin::stripe-payment.organization'), 'count').mockResolvedValue(0)
          jest.spyOn(strapi.plugin('stripe-payment').service('stripe').checkout.sessions, 'create').mockResolvedValue({
            url: 'https://checkout.session.url'
          })
        },
        stripeServiceMethod: 'create',
        stripeServiceArgs: [
          {
            success_url: 'https://success.url',
            metadata: {
              organizationName: 'Test Organization',
              userId: 1,
              planId: 1,
              quantity: 1
            },
            line_items: [{ price: 'price_123', quantity: 1 }],
            mode: 'payment'
          }
        ],
        queryMethod: 'findOne',
        queryArgs: { where: { id: 1 } }
      },
      {
        name: 'should create a checkout session for an existing organization',
        serviceMethodArgs: {
          userId: 1,
          planId: 1,
          quantity: 1,
          organizationId: 1
        },
        expectedResult: 'https://checkout.session.url',
        setupMocks: () => {
          jest.spyOn(strapi.query('plugin::stripe-payment.plan'), 'findOne').mockResolvedValue({
            id: 1,
            stripe_id: 'price_123',
            type: PlanType.ONE_TIME
          })
          jest
            .spyOn(strapi.query('plugin::stripe-payment.organization'), 'findOne')
            .mockResolvedValue({ name: 'Test Organization', customer_id: 11, users: [] })
          jest.spyOn(strapi.plugin('stripe-payment').service('stripe').checkout.sessions, 'create').mockResolvedValue({
            url: 'https://checkout.session.url'
          })
        },
        stripeServiceMethod: 'create',
        customer: 11,
        stripeServiceArgs: [
          {
            success_url: 'https://success.url',
            customer: 11,
            metadata: {
              organizationName: 'Test Organization',
              userId: 1,
              planId: 1,
              quantity: 1
            },
            line_items: [{ price: 'price_123', quantity: 1 }],
            mode: 'payment'
          }
        ]
      }
    ])(
      '$name',
      async ({
        serviceMethodArgs,
        expectedResult,
        setupMocks,
        stripeServiceMethod,
        stripeServiceArgs,
        queryMethod,
        queryArgs
      }) => {
        setupMocks()

        const result = await purchaseService({ strapi }).createCheckoutSession(serviceMethodArgs)

        if (stripeServiceMethod && stripeServiceArgs) {
          expect(
            strapi.plugin('stripe-payment').service('stripe').checkout.sessions[stripeServiceMethod]
          ).toBeCalledWith(...stripeServiceArgs)
        }

        if (queryMethod && queryArgs) {
          expect(strapi.query('plugin::stripe-payment.plan')[queryMethod]).toBeCalledWith(queryArgs)
        }

        expect(result).toEqual(expectedResult)
      }
    )
  })
})
