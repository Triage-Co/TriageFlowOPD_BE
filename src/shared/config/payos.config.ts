import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PayOS } from "@payos/node"
import envInstance from "./env.config";

@Injectable()
export class PayosConfig {
    private readonly payos: PayOS;
    constructor(private readonly configService: ConfigService) {
        console.log(envInstance.PAYOS_API_KEY, envInstance.PAYOS_CHECKSUM_KEY, envInstance.PAYOS_CLIENT_ID);
        const payosApiKey = envInstance.PAYOS_API_KEY || this.configService.get<string>("PAYOS_API_KEY");
        const payosChecksumKey = envInstance.PAYOS_CHECKSUM_KEY || this.configService.get<string>("PAYOS_CHECKSUM_KEY");
        const payosClientId = envInstance.PAYOS_CLIENT_ID || this.configService.get<string>("PAYOS_CLIENT_ID");

        this.payos = new PayOS({
            apiKey: payosApiKey,
            checksumKey: payosChecksumKey,
            clientId: payosClientId
        })
    }

    getClient() {
        console.log()
        return this.payos;
    }
}