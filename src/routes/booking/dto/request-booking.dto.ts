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
        example: "c208b8a9-4c30-4a47-a4d5-0dd8e6b6a5b7"
    })
    shiftId: string
}
