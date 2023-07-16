import type { Workflow } from "@prisma/client";

import emailReminderTemplate from "@calcom/ee/workflows/lib/reminders/templates/emailReminderTemplate";
import { SENDER_NAME } from "@calcom/lib/constants";
import { prisma } from "@calcom/prisma";
import type { PrismaClient } from "@calcom/prisma/client";
import {
  MembershipRole,
  TimeUnit,
  WorkflowActions,
  WorkflowTemplates,
  WorkflowTriggerEvents,
} from "@calcom/prisma/enums";
import type { TrpcSessionUser } from "@calcom/trpc/server/trpc";
import {getDefaultUserTimeFormat} from "@calcom/lib/timeFormat";

import { TRPCError } from "@trpc/server";

import type { TCreateInputSchema } from "./create.schema";

type CreateOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
    prisma: PrismaClient;
  };
  input: TCreateInputSchema;
};

export const createHandler = async ({ ctx, input }: CreateOptions) => {
  const { teamId } = input;

  const userId = ctx.user.id;
  const timeFormat = getDefaultUserTimeFormat(ctx.user.timeFormat);

  if (teamId) {
    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        members: {
          some: {
            userId: ctx.user.id,
            accepted: true,
            NOT: {
              role: MembershipRole.MEMBER,
            },
          },
        },
      },
    });

    if (!team) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
      });
    }
  }

  try {
    const workflow: Workflow = await prisma.workflow.create({
      data: {
        name: "",
        trigger: WorkflowTriggerEvents.BEFORE_EVENT,
        time: 24,
        timeUnit: TimeUnit.HOUR,
        userId,
        teamId,
      },
    });

    await ctx.prisma.workflowStep.create({
      data: {
        stepNumber: 1,
        action: WorkflowActions.EMAIL_ATTENDEE,
        template: WorkflowTemplates.REMINDER,
        reminderBody: emailReminderTemplate(true, WorkflowActions.EMAIL_ATTENDEE, timeFormat).emailBody,
        emailSubject: emailReminderTemplate(true, WorkflowActions.EMAIL_ATTENDEE, timeFormat).emailSubject,
        workflowId: workflow.id,
        sender: SENDER_NAME,
        numberVerificationPending: false,
      },
    });
    return { workflow };
  } catch (e) {
    throw e;
  }
};
