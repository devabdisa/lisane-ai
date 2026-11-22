import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { paymentProduct, speakingLimits } from "@/config/plans";
import { practiceDay } from "@/lib/lesson-session";
import { remainingSpeakingSeconds, splitSpeakingUsage } from "@/lib/speaking-allowance";
import { getPrisma } from "@/server/db";
import { chapaAccepts, initializeChapa, verifyChapa } from "@/server/chapa/client";
import { requireEnv } from "@/lib/env";

export class SpeakingLimitError extends Error {
  readonly code = "limit_reached";

  constructor() {
    super("Speaking time for today is used up.");
    this.name = "SpeakingLimitError";
  }
}

const joinAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function joinCode() {
  const bytes = randomBytes(8);
  return [...bytes].map((value) => joinAlphabet[value % joinAlphabet.length]).join("");
}

function appOrigin() {
  return requireEnv("NEXT_PUBLIC_APP_URL").replace(/\/$/, "");
}

async function allowance(userId: string) {
  const db = getPrisma();
  const today = practiceDay(new Date());
  const now = new Date();
  const [pass, credit, daily, membership, owned] = await Promise.all([
    db.speakingPass.findUnique({ where: { userId } }),
    db.speakingCredit.findUnique({ where: { userId } }),
    db.dailySpeaking.findUnique({ where: { userId_day: { userId, day: today } } }),
    db.organizationMember.findUnique({
      where: { userId },
      include: { organization: { select: { name: true, expiresAt: true } } },
    }),
    db.organization.findFirst({
      where: { ownerId: userId, expiresAt: { gt: new Date() } },
      select: { name: true },
    }),
  ]);
  const school = Boolean((membership && membership.organization.expiresAt > now) || owned);
  const plus = Boolean(pass && pass.expiresAt > now);
  const usedToday = daily?.seconds ?? 0;
  const credits = credit?.seconds ?? 0;
  return {
    today,
    usedToday,
    credits,
    raisedCap: school || plus,
    plusUntil: plus ? pass?.expiresAt ?? null : null,
    schoolName: school ? membership?.organization.name ?? owned?.name ?? null : null,
    remaining: remainingSpeakingSeconds({ usedToday, credits, raisedCap: school || plus }),
  };
}

export async function getSpeakingStatus(userId: string) {
  const status = await allowance(userId);
  return {
    remainingSeconds: status.remaining,
    plusUntil: status.plusUntil?.toISOString() ?? null,
    schoolName: status.schoolName,
    creditSeconds: status.credits,
  };
}

export async function assertSpeakingAllowance(userId: string, neededSeconds: number = speakingLimits.minimumStartSeconds) {
  const status = await allowance(userId);
  if (status.remaining < neededSeconds) throw new SpeakingLimitError();
}

export async function recordSpeaking(userId: string, seconds: number) {
  const status = await allowance(userId);
  const split = splitSpeakingUsage(seconds, Math.max(0, (status.raisedCap ? speakingLimits.plusDailySeconds : speakingLimits.freeDailySeconds) - status.usedToday), status.credits);
  const db = getPrisma();
  await db.$transaction([
    db.dailySpeaking.upsert({
      where: { userId_day: { userId, day: status.today } },
      create: { userId, day: status.today, seconds: split.fromDaily },
      update: { seconds: { increment: split.fromDaily } },
    }),
    db.speakingCredit.upsert({
      where: { userId },
      create: { userId, seconds: 0 },
      update: { seconds: { decrement: split.fromCredit } },
    }),
  ]);
}

export async function startCheckout(params: {
  userId: string;
  email: string;
  name: string;
  productId: string;
  locale: string;
  organizationName?: string;
  returnOrigin?: string;
}) {
  const product = paymentProduct(params.productId);
  if (!product) return { status: "invalid" as const };
  if (product.kind === "school" && !params.organizationName?.trim()) return { status: "invalid" as const };
  const txRef = `lisane-${randomUUID()}`;
  const db = getPrisma();
  await db.payment.create({
    data: {
      userId: params.userId,
      txRef,
      productId: product.id,
      amount: product.amountEtb,
      organizationName: product.kind === "school" ? params.organizationName?.trim() : null,
    },
  });
  const [firstName, ...rest] = params.name.trim().split(/\s+/);
  const origin = appOrigin();
  const returnOrigin = (params.returnOrigin ?? origin).replace(/\/$/, "");
  try {
    const checkoutUrl = await initializeChapa({
      amount: product.amountEtb,
      email: params.email,
      firstName: firstName || "Learner",
      lastName: rest.join(" ") || "Lisane",
      txRef,
      callbackUrl: `${origin}/api/payments/chapa`,
      returnUrl: `${returnOrigin}/${params.locale}/plans/return?tx_ref=${encodeURIComponent(txRef)}`,
      title: "Lisane AI",
    });
    return { status: "ready" as const, checkoutUrl };
  } catch (error) {
    console.error("Chapa checkout failed", { error: error instanceof Error ? error.name : "unknown" });
    return { status: "unavailable" as const };
  }
}

export async function grantVerifiedPayment(txRef: string) {
  const db = getPrisma();
  const payment = await db.payment.findUnique({ where: { txRef } });
  if (!payment) return { status: "missing" as const };
  if (payment.status === "PAID") return { status: "paid" as const };
  const product = paymentProduct(payment.productId);
  if (!product) return { status: "invalid" as const };
  const verified = await verifyChapa(txRef);
  if (!verified || !chapaAccepts(payment.amount, verified)) return { status: "pending" as const };

  return db.$transaction(async (tx) => {
    const updated = await tx.payment.updateMany({
      where: { txRef, status: "PENDING" },
      data: { status: "PAID", paidAt: new Date() },
    });
    if (updated.count !== 1) return { status: "paid" as const };
    if (product.kind === "plus") {
      const current = await tx.speakingPass.findUnique({ where: { userId: payment.userId } });
      const start = current && current.expiresAt > new Date() ? current.expiresAt : new Date();
      await tx.speakingPass.upsert({
        where: { userId: payment.userId },
        create: { userId: payment.userId, expiresAt: new Date(start.getTime() + product.days * 24 * 60 * 60 * 1000) },
        update: { expiresAt: new Date(start.getTime() + product.days * 24 * 60 * 60 * 1000) },
      });
    } else if (product.kind === "minutes") {
      await tx.speakingCredit.upsert({
        where: { userId: payment.userId },
        create: { userId: payment.userId, seconds: product.minutes * 60 },
        update: { seconds: { increment: product.minutes * 60 } },
      });
    } else {
      await tx.organization.create({
        data: {
          name: payment.organizationName || "School",
          ownerId: payment.userId,
          joinCode: joinCode(),
          seats: product.seats,
          expiresAt: new Date(Date.now() + product.days * 24 * 60 * 60 * 1000),
          paymentId: payment.id,
        },
      });
    }
    return { status: "paid" as const };
  });
}

export async function joinSchool(userId: string, code: string) {
  const db = getPrisma();
  const organization = await db.organization.findUnique({
    where: { joinCode: code.trim().toUpperCase() },
    include: { _count: { select: { members: true } } },
  });
  if (!organization || organization.expiresAt <= new Date()) return { status: "invalid" as const };
  const existing = await db.organizationMember.findUnique({ where: { userId } });
  if (existing?.organizationId === organization.id) return { status: "joined" as const, name: organization.name };
  if (existing) return { status: "already" as const };
  if (organization._count.members >= organization.seats) return { status: "full" as const };
  await db.organizationMember.create({ data: { organizationId: organization.id, userId } });
  return { status: "joined" as const, name: organization.name };
}

export async function ownedSchool(userId: string) {
  return getPrisma().organization.findFirst({
    where: { ownerId: userId, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: "desc" },
    select: { name: true, joinCode: true, seats: true, expiresAt: true, _count: { select: { members: true } } },
  });
}
