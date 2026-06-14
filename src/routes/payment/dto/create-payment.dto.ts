import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsString, IsUrl } from "class-validator";

export class CreatePaymentDto {
    @IsNumber()
    @ApiProperty({
        name: "orderCode",
        example: 123456
    })
    orderCode: number;

    @IsNumber()
    @ApiProperty({
        name: "amount",
        example: 2000
    })
    amount: number;

    @IsString()
    @ApiProperty({
        name: "clientId",
        example: "75a51e00-b2e7-447a-b39e-7c00a09cf15c"
    })
    clientId: string;

    @IsUrl()
    @ApiProperty({
        name: "returnUrl",
        example: "https://www.youtube.com/shorts/8Y9-C4UYE_g"
    })
    returnUrl: string;

    @IsUrl()
    @ApiProperty({
        name: "cancelUrl",
        example: "https://www.youtube.com/watch?v=TQM8bUHOEuE"
    })
    cancelUrl: string;
}
