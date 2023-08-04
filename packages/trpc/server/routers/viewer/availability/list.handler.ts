import { prisma } from "@calcom/prisma";

import type { TrpcSessionUser } from "../../../trpc";
import { getDefaultScheduleId, getTeamSchedules } from "./util";

type ListOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
};

export const listHandler = async ({ ctx }: ListOptions) => {
  const { user } = ctx;

  const schedules = await prisma.schedule.findMany({
    where: {
      userId: user.id,
    },
    select: {
      id: true,
      name: true,
      availability: true,
      timeZone: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  const teamSchedules = await getTeamSchedules(user.id, prisma);

  const scheduleIds = schedules.map((schedule) => schedule.id);

  // user who created the a team schedule already has the team schedule as part of their schedules, avoid duplicates.
  const nonDuplicateTeamSchedules = teamSchedules.filter((schedule) =>
    schedule ? !scheduleIds.includes(schedule.id) : false
  );

  const allSchedules = [...schedules, ...nonDuplicateTeamSchedules] as typeof schedules;

  const defaultScheduleId = await getDefaultScheduleId(user.id, prisma);

  if (!user.defaultScheduleId) {
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        defaultScheduleId,
      },
    });
  }

  return {
    schedules: allSchedules.map((schedule) => ({
      ...schedule,
      isDefault: schedule.id === defaultScheduleId,
    })),
  };
};
