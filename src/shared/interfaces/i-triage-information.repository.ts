import { Triage_Information } from '@prisma/client';

export interface ITriageInformationRepository {
  findOneByInterviewToken(
    interviewToken: String,
  ): Promise<Triage_Information | null>;
}
