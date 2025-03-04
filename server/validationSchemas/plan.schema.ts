import * as yup from 'yup'
import { BillingPeriod, PlanType, SupportedCurrency } from '../enums'

export const createPlanSchema = yup.object().shape({
  price: yup.number().required().min(0),
  type: yup
    .mixed<PlanType>()
    .oneOf(Object.values(PlanType) as PlanType[])
    .required(),
  productId: yup.number().required(),
  interval: yup
    .mixed<BillingPeriod>()
    .oneOf(Object.values(BillingPeriod) as BillingPeriod[])
    .when('type', ([type]) =>
      type === PlanType.ONE_TIME ? yup.mixed().notRequired().strip() : yup.mixed<BillingPeriod>().required()
    ),
  currency: yup
    .mixed<SupportedCurrency>()
    .oneOf(Object.values(SupportedCurrency) as SupportedCurrency[])
    .required()
})

export const getPlanByIdSchema = yup.object().shape({
  id: yup.number().required()
})

export const deletePlanSchema = yup.object().shape({
  id: yup.number().required()
})
