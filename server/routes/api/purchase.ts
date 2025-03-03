import extractUserMiddleware from '../../middlewares/extractUser.middleware'

export default [
  {
    method: 'POST',
    path: '/api/purchases/checkout-session',
    handler: 'purchase.createCheckoutSession',
    config: {
      auth: false,
      middlewares: [extractUserMiddleware]
    }
  }
]
