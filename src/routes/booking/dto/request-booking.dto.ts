import { ApiProperty } from "@nestjs/swagger"
import { IsUUID } from "class-validator"

export class CreateBookingDto {
    @IsUUID()
    @ApiProperty({
        name: "userId",
        example: "3258e2eb-83fe-442b-96be-0e2b36245d89"
    })
    userId: string

    @IsUUID()
    @ApiProperty({
        name: "shiftId",
        example: "428b491c-147c-44f5-90d5-bcbbf71444c5"
    })
    shiftId: string
}
