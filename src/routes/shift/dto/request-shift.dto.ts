import { ApiProperty, PartialType } from "@nestjs/swagger"
import { Type } from "class-transformer"
import { IsDate, IsString, MinDate } from "class-validator"
import { IsFutureDate } from "../../../shared/constraint/is_future_date.constaint"

export class CreateShiftRequestDto {
    @IsString()
    @ApiProperty({
        name: "staff_id",
        example: "1149520e-bd19-4cb3-851a-6af485287b25"
    })
    staff_id: string
    @IsString()
    @ApiProperty({
        name: "room_id",
        example: "11090321-c0f9-406e-8884-728ebccb037b"
    })
    room_id: string
    @IsDate()
    @Type(() => Date)
    @ApiProperty({
        name: "date",
        example: "2026-06-25"
    })
    @IsFutureDate()
    date: Date
    @IsString()
    @ApiProperty({
        name: "start_time",
        example: "08:00"
    })
    start_time: string
    @IsString()
    @ApiProperty({
        name: "end_time",
        example: "17:00"
    })
    end_time: string
}

export class UpdateShiftRequestDto extends PartialType(CreateShiftRequestDto) {}
