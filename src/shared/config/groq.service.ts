import { Injectable } from '@nestjs/common';
import { Groq } from 'groq-sdk';
import envInstance from './env.config';
@Injectable()
export class GroqService {
  private groq: Groq;

  constructor() {
    this.groq = new Groq({
      apiKey: envInstance.GROQ_API_KEY,
    });
  }

  groqInstance() {
    return this.groq;
  }
}
