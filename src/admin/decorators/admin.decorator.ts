import { UseGuards, applyDecorators } from '@nestjs/common';
import { AdminGuard } from '../admin.guard';

export const Admin = () => {
  return applyDecorators(
    UseGuards(AdminGuard),
  );
};
