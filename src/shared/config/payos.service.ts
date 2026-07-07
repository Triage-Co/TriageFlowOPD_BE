import { Injectable } from "@nestjs/common";
import { PayOS } from "@payos/node";
import envInstance from "./env.config";

@Injectable()
export class PayosService {
    payos: PayOS;

    constructor() {
        const PAYOS_API_KEY = envInstance.PAYOS_API_KEY;
        const PAYOS_CLIENT_ID = envInstance.PAYOS_CLIENT_ID;
        const PAYOS_CHECKSUM_KEY = envInstance.PAYOS_CHECKSUM_KEY;
        this.payos = new PayOS({
            apiKey: PAYOS_API_KEY,
            clientId: PAYOS_CLIENT_ID,
            checksumKey: PAYOS_CHECKSUM_KEY
        })
    }

    getClient() {
        return this.payos;
    }
}