import { StepTypeEnum } from '@prisma/client';

/** Step types allowed for cross-room load balancing (non-booking queues). */
export const REBALANCEABLE_STEP_TYPES: StepTypeEnum[] = [
  StepTypeEnum.LAB_TEST,
  StepTypeEnum.IMAGING,
  StepTypeEnum.PROCEDURE,
  StepTypeEnum.FUNCTIONAL_EXPLORATION,
];
