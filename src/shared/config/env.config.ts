import path from "path";
import fs from "fs";
import { IsString, validateSync } from "class-validator";
import { plainToInstance } from "class-transformer";
import { config } from 'dotenv'
config({
    path: ".env"
})


if (!fs.existsSync(path.resolve(".env"))) {
    console.log("File .env không tồn tại");
    process.exit(1);
}


class EnvClass {
    @IsString({ message: "Thiếu DATABASE_URL TRONG FILE .ENV" })
    DATABASE_URL: string;
    @IsString({ message: "Thiếu SUPABASE_KEY TRONG FILE .ENV" })
    SUPABASE_KEY: string;
    @IsString({ message: "Thiếu SUPABASE_URL TRONG FILE .ENV" })
    SUPABASE_URL: string;
    @IsString({ message: "Thiếu PORT TRONG FILE .ENV" })
    PORT: string;
}

const envInstance = plainToInstance(EnvClass, process.env);

const error = validateSync(envInstance);

if (error.length > 0) {
    const e = error.map((e) => {
        return {
            constraints: e.constraints,
            property: e.property,
            value: e.value
        }
    })
    throw e;
}

export default envInstance;