import { Triage_Information } from '@prisma/client';
import { ITriageInformationRepository } from '../interfaces/i-triage-information.repository';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';

@Injectable()
export class PrismaTriageInformationRepository implements ITriageInformationRepository {
  constructor(private readonly prismaService: PrismaService) {}

  findOneByInterviewToken(
    interviewToken: string,
  ): Promise<Triage_Information | null> {
    return this.prismaService.triage_Information.findFirst({
      where: {
        interview_token: interviewToken,
      },
    });
  }
}
