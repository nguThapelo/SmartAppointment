import type { AnswerType, FeedbackQuestion, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditActor, SYSTEM, type ServiceActor, type ServiceCtx } from "@/server/actors";
import { recordAudit } from "@/server/audit";
import { conflict, forbidden, notFound, unprocessable } from "@/server/errors";
import { loadVisible, transition } from "@/server/services/booking";

// Feedback question sets (global by admins, custom per provider) and client
// responses. Fixes audit M-4/M-5: answers must belong to a set that applies to
// THIS booking, sets are only readable/editable by their owners, and one
// response per booking is enforced by the DB.

export const setCreateSchema = z.object({ title: z.string().trim().min(3).max(120) }).strict();
export const setUpdateSchema = z
  .object({ title: z.string().trim().min(3).max(120).optional(), isActive: z.boolean().optional() })
  .strict();
export const questionSchema = z
  .object({
    text: z.string().trim().min(3).max(300),
    answerType: z.enum(["RATING_1_5", "TEXT", "YES_NO", "SINGLE_CHOICE"]),
    options: z.array(z.string().trim().min(1).max(80)).min(2).max(10).optional(),
    isRequired: z.boolean().default(true),
    sortOrder: z.number().int().min(0).max(100).default(0),
  })
  .strict()
  .refine((q) => q.answerType !== "SINGLE_CHOICE" || q.options, "Choice questions need options");
export const questionUpdateSchema = z
  .object({
    text: z.string().trim().min(3).max(300).optional(),
    isRequired: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(100).optional(),
  })
  .strict();
export const submitSchema = z
  .object({
    answers: z
      .array(z.object({ questionId: z.string().min(1).max(40), value: z.string().trim().max(2000) }).strict())
      .min(1)
      .max(50),
  })
  .strict();

// ── Question sets ───────────────────────────────────────────────────────────

function setVisibility(actor: ServiceActor): Prisma.FeedbackQuestionSetWhereInput {
  if (actor.kind !== "user") throw forbidden();
  if (actor.user.role === "ADMIN") return {};
  if (actor.user.role === "PROVIDER") return { OR: [{ scope: "GLOBAL" }, { ownerId: actor.user.id }] };
  return { scope: "GLOBAL", isActive: true };
}

export async function listSets(actor: ServiceActor) {
  const sets = await prisma.feedbackQuestionSet.findMany({
    where: setVisibility(actor),
    include: { questions: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  return sets.map((s) => ({
    id: s.id, title: s.title, scope: s.scope, isActive: s.isActive,
    editable: canEditSet(actor, s),
    questions: s.questions.map(toQuestionDTO),
  }));
}

function canEditSet(actor: ServiceActor, set: { scope: string; ownerId: string | null }) {
  if (actor.kind !== "user") return false;
  if (actor.user.role === "ADMIN") return true;
  return actor.user.role === "PROVIDER" && set.scope === "PROVIDER" && set.ownerId === actor.user.id;
}

async function editableSet(actor: ServiceActor, setId: string) {
  const set = await prisma.feedbackQuestionSet.findFirst({ where: { id: setId, ...setVisibility(actor) } });
  if (!set) throw notFound("Question set");
  if (!canEditSet(actor, set)) throw forbidden("Only the owner can change this question set");
  return set;
}

export async function createSet(actor: ServiceActor, input: z.infer<typeof setCreateSchema>, ctx: ServiceCtx = {}) {
  if (actor.kind !== "user" || actor.user.role === "CLIENT") throw forbidden();
  const isAdmin = actor.user.role === "ADMIN";
  const set = await prisma.feedbackQuestionSet.create({
    data: { title: input.title, scope: isAdmin ? "GLOBAL" : "PROVIDER", ownerId: isAdmin ? null : actor.user.id },
  });
  await recordAudit(prisma, {
    ...auditActor(actor, ctx), action: "feedback.set_create", entityType: "FeedbackQuestionSet",
    entityId: set.id, outcome: "success", requestId: ctx.requestId, detail: { scope: set.scope },
  });
  return set;
}

export async function updateSet(actor: ServiceActor, setId: string, input: z.infer<typeof setUpdateSchema>, ctx: ServiceCtx = {}) {
  await editableSet(actor, setId);
  const set = await prisma.feedbackQuestionSet.update({ where: { id: setId }, data: input });
  await recordAudit(prisma, {
    ...auditActor(actor, ctx), action: "feedback.set_update", entityType: "FeedbackQuestionSet",
    entityId: setId, outcome: "success", requestId: ctx.requestId,
  });
  return set;
}

export async function addQuestion(actor: ServiceActor, setId: string, input: z.infer<typeof questionSchema>, ctx: ServiceCtx = {}) {
  await editableSet(actor, setId);
  const q = await prisma.feedbackQuestion.create({
    data: { setId, text: input.text, answerType: input.answerType, options: input.options ?? undefined, isRequired: input.isRequired, sortOrder: input.sortOrder },
  });
  await recordAudit(prisma, {
    ...auditActor(actor, ctx), action: "feedback.question_add", entityType: "FeedbackQuestion",
    entityId: q.id, outcome: "success", requestId: ctx.requestId,
  });
  return toQuestionDTO(q);
}

export async function updateQuestion(actor: ServiceActor, questionId: string, input: z.infer<typeof questionUpdateSchema>, ctx: ServiceCtx = {}) {
  const q = await prisma.feedbackQuestion.findUnique({ where: { id: questionId } });
  if (!q) throw notFound("Question");
  await editableSet(actor, q.setId);
  const updated = await prisma.feedbackQuestion.update({ where: { id: questionId }, data: input });
  await recordAudit(prisma, {
    ...auditActor(actor, ctx), action: "feedback.question_update", entityType: "FeedbackQuestion",
    entityId: questionId, outcome: "success", requestId: ctx.requestId,
  });
  return toQuestionDTO(updated);
}

function toQuestionDTO(q: FeedbackQuestion) {
  return {
    id: q.id, text: q.text, answerType: q.answerType,
    options: Array.isArray(q.options) ? (q.options as string[]) : null,
    isRequired: q.isRequired, sortOrder: q.sortOrder,
  };
}

// ── Per-booking questions and responses ─────────────────────────────────────

async function applicableQuestions(providerId: string) {
  const sets = await prisma.feedbackQuestionSet.findMany({
    where: { isActive: true, OR: [{ scope: "GLOBAL" }, { scope: "PROVIDER", ownerId: providerId }] },
    include: { questions: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ scope: "asc" }, { createdAt: "asc" }],
  });
  return sets.flatMap((s) => s.questions);
}

export async function feedbackForBooking(actor: ServiceActor, bookingKey: string) {
  const { booking, party } = await loadVisible(actor, bookingKey);
  const [questions, response] = await Promise.all([
    applicableQuestions(booking.providerId),
    prisma.feedbackResponse.findUnique({ where: { bookingId: booking.id }, include: { answers: true } }),
  ]);
  return {
    canSubmit: party === "client" && booking.status === "COMPLETED" && !response,
    questions: questions.map(toQuestionDTO),
    response: response
      ? {
          submittedAt: response.submittedAt.toISOString(),
          answers: response.answers.map((a) => ({ questionId: a.questionId, value: a.value })),
        }
      : null,
  };
}

function validateAnswer(type: AnswerType, value: string, options: string[] | null): string | null {
  switch (type) {
    case "RATING_1_5":
      return /^[1-5]$/.test(value) ? null : "Ratings must be 1 to 5";
    case "YES_NO":
      return ["yes", "no"].includes(value.toLowerCase()) ? null : "Answer yes or no";
    case "SINGLE_CHOICE":
      return options?.includes(value) ? null : "Pick one of the listed options";
    case "TEXT":
      return value.length <= 2000 ? null : "Answer is too long";
  }
}

export async function submitFeedback(actor: ServiceActor, bookingKey: string, input: z.infer<typeof submitSchema>, ctx: ServiceCtx = {}) {
  const { booking, party } = await loadVisible(actor, bookingKey);
  if (party !== "client") throw forbidden("Only the client can leave feedback");
  if (booking.status !== "COMPLETED") {
    throw unprocessable("NOT_COMPLETED", "Feedback opens once the appointment is completed");
  }

  const questions = await applicableQuestions(booking.providerId);
  const byId = new Map(questions.map((q) => [q.id, q]));
  const errors: Record<string, string> = {};
  const seen = new Set<string>();
  for (const a of input.answers) {
    const q = byId.get(a.questionId);
    if (!q) {
      errors[a.questionId] = "Not a question for this booking";
      continue;
    }
    if (seen.has(a.questionId)) errors[a.questionId] = "Answered twice";
    seen.add(a.questionId);
    const bad = validateAnswer(q.answerType, a.value, Array.isArray(q.options) ? (q.options as string[]) : null);
    if (bad) errors[a.questionId] = bad;
  }
  for (const q of questions) if (q.isRequired && !seen.has(q.id)) errors[q.id] = "Required";
  if (Object.keys(errors).length) throw unprocessable("INVALID_ANSWERS", "Please check your answers", errors);

  try {
    await prisma.$transaction(async (tx) => {
      const response = await tx.feedbackResponse.create({
        data: { bookingId: booking.id, clientId: booking.clientId!, providerId: booking.providerId },
      });
      await tx.feedbackAnswer.createMany({
        data: input.answers.map((a) => ({ responseId: response.id, questionId: a.questionId, value: a.value })),
      });
      await recordAudit(tx, {
        ...auditActor(actor, ctx), action: "feedback.submit", entityType: "Booking", entityId: booking.id,
        outcome: "success", requestId: ctx.requestId, detail: { answers: input.answers.length },
      });
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") throw conflict("ALREADY_SUBMITTED", "Feedback was already submitted for this booking");
    throw err;
  }

  // Feedback closes the booking's lifecycle.
  await transition(SYSTEM, booking.id, "close", {}, ctx, { notify: false }).catch(() => undefined);
  return feedbackForBooking(actor, booking.id);
}

/** Responses the actor may read: providers their own, clients their own, admins all. */
export async function listResponses(actor: ServiceActor) {
  if (actor.kind !== "user") throw forbidden();
  const where: Prisma.FeedbackResponseWhereInput =
    actor.user.role === "ADMIN" ? {} : actor.user.role === "PROVIDER" ? { providerId: actor.user.id } : { clientId: actor.user.id };
  const rows = await prisma.feedbackResponse.findMany({
    where,
    orderBy: { submittedAt: "desc" },
    take: 100,
    include: {
      booking: { select: { reference: true, serviceName: true, startsAt: true } },
      answers: { include: { question: { select: { text: true, answerType: true } } } },
    },
  });
  const ratings = rows.flatMap((r) => r.answers.filter((a) => a.question.answerType === "RATING_1_5").map((a) => Number(a.value)));
  return {
    averageRating: ratings.length ? Math.round((ratings.reduce((s, n) => s + n, 0) / ratings.length) * 10) / 10 : null,
    data: rows.map((r) => ({
      reference: r.booking.reference,
      serviceName: r.booking.serviceName,
      startsAt: r.booking.startsAt.toISOString(),
      submittedAt: r.submittedAt.toISOString(),
      answers: r.answers.map((a) => ({ question: a.question.text, type: a.question.answerType, value: a.value })),
    })),
  };
}
