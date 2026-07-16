import { Resend } from 'resend';
import envInstance from './env.config';

export const resend = new Resend(envInstance.RESEND_KEY);
