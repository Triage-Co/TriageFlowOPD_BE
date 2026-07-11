import { ApiProperty } from "@nestjs/swagger"
import { StepStatusEnum } from "@prisma/client"
import { IsEnum, IsUUID } from "class-validator"

export class CreateParentStepReqDto {
    @IsUUID()
    @ApiProperty({
        name: "flow_id",
        example: ""
    })
    flow_id: string

    @IsUUID()
    @ApiProperty({
        name: "room_id",
        example: ""
    })
    room_id: string

    @IsEnum(StepStatusEnum)
    @ApiProperty({
        name: "step_status",
        example: ""
    })
    step_status: string

    @IsUUID()
    @ApiProperty({
        name: "staff_id",
        example: ""
    })
    staff_id: string

}
export class CreateSubStepReqDto {
    @IsUUID()
    @ApiProperty({
        name: "parent_step_id",
        example: ""
    })
    parent_step_id: string

    @IsUUID()
    @ApiProperty({
        name: "room_id",
        example: ""
    })
    room_id: string

    @IsEnum(StepStatusEnum)
    @ApiProperty({
        name: "step_status",
        example: ""
    })
    step_status: string

    @IsUUID()
    @ApiProperty({
        name: "staff_id",
        example: ""
    })
    staff_id: string
}