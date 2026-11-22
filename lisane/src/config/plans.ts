export const speakingLimits = {
  freeDailySeconds: 5 * 60,
  plusDailySeconds: 30 * 60,
  minimumStartSeconds: 30,
  lessonSpeechSeconds: 15,
} as const;

export const paymentProducts = [
  {
    id: "plus",
    kind: "plus",
    days: 30,
    amountEtb: 300,
    titleKey: "plusTitle",
    detailKey: "plusDetail",
  },
  {
    id: "minutes-30",
    kind: "minutes",
    minutes: 30,
    amountEtb: 80,
    titleKey: "minutes30Title",
    detailKey: "minutes30Detail",
  },
  {
    id: "minutes-90",
    kind: "minutes",
    minutes: 90,
    amountEtb: 200,
    titleKey: "minutes90Title",
    detailKey: "minutes90Detail",
  },
  {
    id: "school",
    kind: "school",
    seats: 30,
    days: 120,
    amountEtb: 4500,
    titleKey: "schoolTitle",
    detailKey: "schoolDetail",
  },
] as const;

export type PaymentProduct = (typeof paymentProducts)[number];
export type PaymentProductId = PaymentProduct["id"];

export function paymentProduct(id: string) {
  return paymentProducts.find((product) => product.id === id) ?? null;
}
