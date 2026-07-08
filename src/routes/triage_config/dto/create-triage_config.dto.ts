import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from "class-validator";

export class CreateTriageConfigDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({
        name: "rule_key",
        example: "DIAGNOSIS_CONFIG",
        description: "Từ khóa định danh cho cấu hình"
    })
    rule_key: string;

    @IsObject()
    @IsOptional()
    @ApiPropertyOptional({
        name: "rule_value",
        example: { number_of_diagnoise: 5 },
        description: "Dữ liệu cấu hình lưu dưới dạng JSON"
    })
    rule_value?: Record<string, any>;
}
