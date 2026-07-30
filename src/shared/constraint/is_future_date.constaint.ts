import {
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'IsFutureDate', async: false })
export class IsFutureDateConstraint implements ValidatorConstraintInterface {
  validate(value: Date): boolean {
    if (!(value instanceof Date) || isNaN(value.getTime())) {
      return false;
    }

    const input = new Date(value);
    input.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return input > today;
  }
  defaultMessage?(): string {
    return 'Ngày phải lớn hơn ngày hiện tại';
  }
}

export function IsFutureDate() {
  return Validate(IsFutureDateConstraint);
}
