import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { AccountService } from './account.service';
import { BanReqDto, CreateAccountDto } from './dto/req-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { IsRoleGuard } from '../../shared/guards/is-role.guard';
import { roles } from '../../shared/decorator/role.decorator';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@Controller('account')
@ApiBearerAuth()
@roles('ADMIN')
@UseGuards(IsAuthGuard, IsRoleGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  @ApiOperation({
    summary: '[ADMIN] tìm tất cả người dùng theo phía Admin',
  })
  findAll() {
    return this.accountService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: '[ADMIN] tìm người dùng theo account id phía Admin',
  })
  findOne(@Param('id') id: string) {
    return this.accountService.findOne(id);
  }

  @Patch(':id/ban')
  @ApiOperation({
    summary: '[ADMIN] Ban người dùng phía Admin',
  })
  ban(@Param('id') id: string, @Body() banReqDto: BanReqDto) {
    return this.accountService.ban(id, banReqDto);
  }

  @Patch(':id/unban')
  @ApiOperation({
    summary: '[ADMIN] Unban người dùng phía Admin',
  })
  unBan(@Param('id') id: string) {
    return this.accountService.unBan(id);
  }
}
