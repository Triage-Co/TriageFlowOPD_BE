import { Triage_Information } from '@prisma/client';

export interface ITriageInformationRepository {
  findOneByInterviewToken(
    interviewToken: string,
  ): Promise<Triage_Information | null>;
}
