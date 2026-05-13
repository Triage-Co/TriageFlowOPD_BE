import { ApiProperty } from "@nestjs/swagger";

export class BaseResponse<T> {
    @ApiProperty()
    code: number;
    @ApiProperty()
    status: "success" | "error";
    @ApiProperty()
    message: string;
    @ApiProperty()
    data?: T
}