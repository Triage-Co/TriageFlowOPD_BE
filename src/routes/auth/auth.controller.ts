import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  ForgotPasswordRequestDto,
  RefreshTokenRequestDto,
  SignInWithCitizenIdRequestDto,
  SignInWithEmailRequestDto,
  SignInWithOtpRequestDto,
  SignOutReqRequestDto,
  SignUpReqDto,
  UpdateUserRequestDto,
  VerifyAndResetPasswordRequestDto,
  VerifyOtpSignInRequestDto,
} from './dto/request-auth.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { IsAuthGuard } from '../../shared/guards/is-auth.guard';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }


  @Post('/register')
  signUp(@Body() signUpDto: SignUpReqDto) {
    return this.authService.signUp(signUpDto);
  }

  @Post('/login')
  signInWithEmail(
    @Body() signInWithEmailRequestDto: SignInWithEmailRequestDto,
  ) {
    return this.authService.signInWithEmail(signInWithEmailRequestDto);
  }

  
  @Post('/login/citizen-id')
  signInWithCitizenId(
    @Body() signInWithCitizenIdRequestDto: SignInWithCitizenIdRequestDto,
  ) {
    return this.authService.SignInWithCitizenId(signInWithCitizenIdRequestDto);
  }

  @Post('/otp/send')
  signInWithOtp(@Body() signInWithOtpRequestDto: SignInWithOtpRequestDto) {
    return this.authService.signInWithOtp(signInWithOtpRequestDto);
  }

  @Post('/otp/verify')
  verifyOtpSignIn(
    @Body() verifyOtpSignInRequestDto: VerifyOtpSignInRequestDto,
  ) {
    return this.authService.verifyOtpSignIn(verifyOtpSignInRequestDto);
  }

  @Post('/forgot')
  forgotPassword(@Body() forgotPasswordRequestDto: ForgotPasswordRequestDto) {
    return this.authService.forgotPassword(forgotPasswordRequestDto);
  }

  @Post('/forgot/verify')
  verifyAndResetPassword(
    @Body() verifyAndResetPasswordRequestDto: VerifyAndResetPasswordRequestDto,
  ) {
    return this.authService.verifyAndResetPassword(
      verifyAndResetPasswordRequestDto,
    );
  }


  @Get('/profile')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  getProfile(@Req() req: any) {
    const id = req.user.id || req.user.sub;
    return this.authService.getProfile(id);
  }

  @Post('/refresh')
  refreshToken(@Body() refreshTokenRequestDto: RefreshTokenRequestDto) {
    return this.authService.refreshToken(refreshTokenRequestDto);
  }

  @Post('/logout')
  signOut(@Body() signOutRequestDto: SignOutReqRequestDto) {
    return this.authService.signOut(signOutRequestDto);
  }



  @Patch('/update')
  @ApiBearerAuth()
  @UseGuards(IsAuthGuard)
  updateUser(
    @Req() req: any,
    @Body() updateUserRequestDto: UpdateUserRequestDto,
  ) {
    const { id } = req.user;
    return this.authService.updateProfile(id, updateUserRequestDto);
  }
}
