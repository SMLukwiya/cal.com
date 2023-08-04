import type { Availability as AvailabilityModel, Schedule as ScheduleModel, User } from "@prisma/client";

import type { PrismaClient } from "@calcom/prisma/client";
import type { Schedule } from "@calcom/types/schedule";

export const getDefaultScheduleId = async (userId: number, prisma: PrismaClient) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      defaultScheduleId: true,
    },
  });

  if (user?.defaultScheduleId) {
    return user.defaultScheduleId;
  }

  // If we're returning the default schedule for the first time then we should set it in the user record
  const defaultSchedule = await prisma.schedule.findFirst({
    where: {
      userId,
    },
    select: {
      id: true,
    },
  });

  if (!defaultSchedule) {
    // Handle case where defaultSchedule is null by throwing an error
    throw new Error("No schedules found for user");
  }

  return defaultSchedule.id;
};

export const hasDefaultSchedule = async (user: Partial<User>, prisma: PrismaClient) => {
  const defaultSchedule = await prisma.schedule.findFirst({
    where: {
      userId: user.id,
    },
  });
  return !!user.defaultScheduleId || !!defaultSchedule;
};

export const convertScheduleToAvailability = (
  schedule: Partial<ScheduleModel> & { availability: AvailabilityModel[] }
) => {
  return schedule.availability.reduce(
    (schedule: Schedule, availability) => {
      availability.days.forEach((day) => {
        schedule[day].push({
          start: new Date(
            Date.UTC(
              new Date().getUTCFullYear(),
              new Date().getUTCMonth(),
              new Date().getUTCDate(),
              availability.startTime.getUTCHours(),
              availability.startTime.getUTCMinutes()
            )
          ),
          end: new Date(
            Date.UTC(
              new Date().getUTCFullYear(),
              new Date().getUTCMonth(),
              new Date().getUTCDate(),
              availability.endTime.getUTCHours(),
              availability.endTime.getUTCMinutes()
            )
          ),
        });
      });
      return schedule;
    },
    Array.from([...Array(7)]).map(() => [])
  );
};

export const setupDefaultSchedule = async (userId: number, scheduleId: number, prisma: PrismaClient) => {
  return prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      defaultScheduleId: scheduleId,
    },
  });
};

export const getTeamSchedules = async (userId: number, prisma: PrismaClient) => {
  const membershipsWithTeamSchedules = await prisma.membership.findMany({
    where: {
      userId: userId,
    },
    select: {
      team: {
        select: {
          eventTypes: {
            select: {
              schedule: {
                select: {
                  id: true,
                  userId: true,
                  name: true,
                  availability: true,
                  timeZone: true,
                  eventType: {
                    select: {
                      _count: true,
                      id: true,
                      eventName: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // teamEvent has one-to-one relation to schedule
  const teamSchedules = membershipsWithTeamSchedules
    .map((membership) => membership.team.eventTypes)
    .map((teamEventType) => teamEventType[0].schedule);

  return teamSchedules;
};

export const isTeamSchedule = async (userId: number, prisma: PrismaClient, scheduleId?: number) => {
  const teamSchedules = await getTeamSchedules(userId, prisma);
  const teamScheduleFound = teamSchedules.find((teamSchedule) => teamSchedule?.id === scheduleId);
  return teamScheduleFound ? true : false;
};
