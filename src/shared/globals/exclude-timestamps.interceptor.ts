import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

@Injectable()
export class ExcludeTimestampInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    return next.handle().pipe(map((data) => this.removeTimestamps(data)));
  }

  private removeTimestamps(obj: any) {
    if (!obj || typeof obj != 'object' || obj instanceof Date) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.removeTimestamps(item));
    }

    const newObj = { ...obj };
    delete newObj.createdAt;
    delete newObj.updatedAt;

    for (const key of Object.keys(newObj)) {
      newObj[key] = this.removeTimestamps(newObj[key]);
    }

    return newObj;
  }
}
