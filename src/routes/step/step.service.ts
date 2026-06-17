import { Injectable } from '@nestjs/common';
import { CreateStepDto } from './dto/request-step.dto';
import { UpdateStepDto } from './dto/response-step.dto';
import { PrismaConfig } from '../../shared/config/prisma.config';

@Injectable()
export class StepService {

  constructor(private readonly pismaClient: PrismaConfig) { }

  async create(createStepDto: CreateStepDto) {
    try {



      const data = await this.pismaClient.$transaction(async (tx) => {
        const lastStep = await tx.step.findFirst({
          where: {
            flowId: createStepDto.flowId
          }, orderBy: {
            number: "desc"
          }
        })

        const nextNumber = lastStep ? lastStep.number + 1 : 1;
        return tx.step.create({
          data: {
            flowId: createStepDto.flowId,
            name: createStepDto.name,
            description: createStepDto.description,
            number: nextNumber
          }
        })
      })



      return {
        code: 200,
        message: "Tạo bước thành công",
        status: "success",
        data: data
      };
    } catch (error) {
      return {
        code: 500,
        message: error,
        status: "error",
      }
    }
  }

  async findAll() {
    try {
      const data = await this.pismaClient.step.findMany()
      return {
        code: 200,
        message: "Tìm tất cả các bước thành công",
        status: "success",
        data: data
      };
    } catch (error) {
      return {
        code: 500,
        message: error,
        status: "error",
      }
    }
  }

  async findStepByFlow(id: string) {
    try {
      const data = await this.pismaClient.step.findMany({
        where: {
          flowId: id
        }, orderBy: {
          number: 'asc'
        }
      })
      return {
        code: 200,
        message: "Tìm tất cả các bước theo luồng thành công",
        status: "success",
        data: data
      };
    } catch (error) {
      return {
        code: 500,
        message: error,
        status: "error",
      }
    }
  }

}
