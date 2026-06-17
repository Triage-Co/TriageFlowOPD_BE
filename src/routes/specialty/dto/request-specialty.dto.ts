import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsUUID } from "class-validator";

export class CreateSpecialtyDto {
    @IsString()
    @ApiProperty({
        name: "name",
        example: "Khoa Nhi"
    })
    name: string
}
