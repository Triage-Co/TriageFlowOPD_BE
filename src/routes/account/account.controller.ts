import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { AccountService } from './account.service';
import { BanReqDto, CreateAccountDto } from './dto/req-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  findAll() {
    return this.accountService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.accountService.findOne(id);
  }

  @Patch(':id/ban')
  ban(@Param('id') id: string, @Body() banReqDto: BanReqDto) {
    return this.accountService.ban(id, banReqDto);
  }

  @Patch(':id/unban')
  unBan(@Param('id') id: string) {
    return this.accountService.unBan(id);
  }
}
