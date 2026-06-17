import { ApiProperty, PartialType } from "@nestjs/swagger"
import { ShiftStatus } from "@prisma/client"
import { IsDate, IsNumber, IsOptional, IsString } from "class-validator"

export class CreateShiftDto {
    @IsString()
    @ApiProperty({
        name: "doctorId",
        example: "0ed5e33a-c999-4eb4-ab50-b4f1800b37fd"
    })
    doctorId: string

    @IsDate()
    @IsOptional()
    @ApiProperty({
        name: "date",
        example: "2026-06-17"
    })
    date: Date

    @IsString()
    @ApiProperty({
        name: "startTime",
        example: "07:00"
    })
    startTime: string
    @IsString()
    @ApiProperty({
        name: "endTime",
        example: "08:00"
    })
    endTime: string
    @IsNumber()
    @ApiProperty({
        name: "capacity",
        example: 10
    })
    capacity: number
    @IsString()
    @ApiProperty({
        name: "status",
        example: "AVAILABLE"
    })
    status: ShiftStatus
}

export class UpdateShiftDto extends PartialType(CreateShiftDto) {
}