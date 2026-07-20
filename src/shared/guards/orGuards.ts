import { CanActivate, ExecutionContext, Injectable, mixin, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

export function orGuard(...guards: Type<CanActivate>[]): Type<CanActivate> {
    @Injectable()
    class MixinOrGuard implements CanActivate {
      constructor(private readonly moduleRef: ModuleRef) {}
      async canActivate(context: ExecutionContext): Promise<boolean> {
        let exceptions: unknown[] = [];
        for (const guard of guards) {
          try {
            const guardInstance = this.moduleRef.get(guard, { strict: false });
            const canActivate = await guardInstance.canActivate(context);
            if (canActivate) {
              return true;
            }
          } catch (error) {
            exceptions.push(error);
          }
        }

        if (exceptions.length > 0) {
          throw exceptions[exceptions.length - 1];
        }

        return false;
      }
    }
  return mixin(MixinOrGuard);
}
