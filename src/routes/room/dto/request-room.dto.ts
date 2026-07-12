import { ApiProperty, PartialType } from "@nestjs/swagger"
import { IsOptional, IsString, IsUUID } from "class-validator"

export class CreateRoomRequestDto {
    @IsString()
    @ApiProperty({
        name: "room_name",
        example: "P_1"
    })
    room_name: string

    @IsUUID()
    @IsOptional()
    physical_room_id?: string

    @IsUUID()
    @ApiProperty({
        name: "specialty_id",
        example: "082650f9-be60-48c3-8039-f6d48ad11144"
    })
    specialty_id?: string
}


export class UpdateRoomRequestDto extends PartialType(CreateRoomRequestDto) { }

