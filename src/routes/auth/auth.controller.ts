import { Controller, Post, Body, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ForgotPasswordDto, RefreshTokenReqDto, SignInReqDto, SignInReqWithOtpDto, SignInWithCitizenIdReqDto, SignOutReqDto, SignUpReqDto, VerifyOtpDto, VerifyOtpReqDto } from './dto/auth-request.dto';
import { ApiBadRequestResponse, ApiConflictResponse, ApiInternalServerErrorResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiUnauthorizedResponse } from '@nestjs/swagger';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post("/signin")
  @ApiOperation({
    summary: "Đăng nhập",
    tags: ["Auth"]
  })
  @ApiOkResponse({
    schema: {
      example: {
        "code": 200,
        "message": "Đăng nhập thành công",
        "status": "success",
        "data": {
          "token": "eyJhbGciOiJFUzI1NiIsImtpZCI6ImI3MDQ4MWFlLWYyZDktNGUzYy05MTIyLWM0MTc1ZmM4MWM0NyIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL290Z29ibHFnaW9kcGVybWdvbHVhLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI4MDExNDIzMi0xNWU3LTQ5MzktOTQ4Yi03MzY2MDUyMzYzNDQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc4NzI4NTUxLCJpYXQiOjE3Nzg2NDIxNTEsImVtYWlsIjoidGhhaW5nb2NkZzIwMDM1NTNAZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJhZ2UiOjIwLCJlbWFpbCI6InRoYWluZ29jZGcyMDAzNTUzQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmdWxsX25hbWUiOiJExrDGoW5nIFRow6FpIE5n4buNYyIsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwic3ViIjoiODAxMTQyMzItMTVlNy00OTM5LTk0OGItNzM2NjA1MjM2MzQ0In0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3Nzg2NDIxNTF9XSwic2Vzc2lvbl9pZCI6IjY4MGJmNzE2LTBhMjktNDQyYy05NmMxLTM2MDFiMzM5ZmUyNiIsImlzX2Fub255bW91cyI6ZmFsc2V9.29l7Zeypaq36XQ9Q63SQ31qsz_ImVVZQoEkJUhG7S1zLg02NL8SMm4K-7wfA6bYvLdDg0tCrEGeLHyeAIxRUBA",
          "refreshToken": "ligtf7n4wyrk"
        }
      }
    }
  })
  @ApiUnauthorizedResponse({
    schema: {
      example: {
        "code": 401,
        "status": "error",
        "message": "Email hoặc mật khẩu không chính xác",
        "detail": "Invalid login credentials"
      }
    }
  })
  signIn(@Body() signInReqDto: SignInReqDto) {
    return this.authService.signIn(signInReqDto);
  }



  @Post("/signin/citizen")
  @ApiOperation({
    summary: "Đăng nhập bằng CMND/CCCD",
    tags: ["Auth"]
  })
  @ApiOkResponse({
    schema: {
      example: {
        "code": 200,
        "message": "Đăng nhập thành công",
        "status": "success",
        "data": {
          "token": "eyJhbGciOiJFUzI1NiIsImtpZCI6ImI3MDQ4MWFlLWYyZDktNGUzYy05MTIyLWM0MTc1ZmM4MWM0NyIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL290Z29ibHFnaW9kcGVybWdvbHVhLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI4MDExNDIzMi0xNWU3LTQ5MzktOTQ4Yi03MzY2MDUyMzYzNDQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc4NzI4NTUxLCJpYXQiOjE3Nzg2NDIxNTEsImVtYWlsIjoidGhhaW5nb2NkZzIwMDM1NTNAZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJhZ2UiOjIwLCJlbWFpbCI6InRoYWluZ29jZGcyMDAzNTUzQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmdWxsX25hbWUiOiJExrDGoW5nIFRow6FpIE5n4buNYyIsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwic3ViIjoiODAxMTQyMzItMTVlNy00OTM5LTk0OGItNzM2NjA1MjM2MzQ0In0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3Nzg2NDIxNTF9XSwic2Vzc2lvbl9pZCI6IjY4MGJmNzE2LTBhMjktNDQyYy05NmMxLTM2MDFiMzM5ZmUyNiIsImlzX2Fub255bW91cyI6ZmFsc2V9.29l7Zeypaq36XQ9Q63SQ31qsz_ImVVZQoEkJUhG7S1zLg02NL8SMm4K-7wfA6bYvLdDg0tCrEGeLHyeAIxRUBA",
          "refreshToken": "ligtf7n4wyrk"
        }
      }
    }
  })
  @ApiUnauthorizedResponse({
    schema: {
      example: {
        "code": 401,
        "status": "error",
        "message": "Email hoặc mật khẩu không chính xác",
        "detail": "Invalid login credentials"
      }
    }
  })
  @ApiNotFoundResponse({
    schema: {
      example: {
        "code": 404,
        "status": "error",
        "message": "Không tìm thấy tài khoản với CMND/CCCD này.",
      }
    }
  })
  @ApiInternalServerErrorResponse({
    schema: {
      example: {
        "code": 500,
        "status": 'error',
        "message": 'Đã có lỗi hệ thống xảy ra trong quá trình đăng ký. Vui lòng thử lại sau.',
        "detail": "Đã có lỗi xảy ra"
      }
    }
  })
  signInWithCitizenId(@Body() signInWithCitizenIdReqDto: SignInWithCitizenIdReqDto) {
    return this.authService.signInWithCitizenId(signInWithCitizenIdReqDto);
  }


  @Post("/otp/send")
  @ApiOperation({
    summary: "Gửi OTP đến email, đăng nhập",
    tags: ["Auth"]
  })
  @ApiOkResponse({
    schema: {
      example: {
        "code": 200,
        "message": "Gửi OTP thành công",
        "status": "success"
      }
    }
  })
  @ApiBadRequestResponse({
    schema: {
      example: {
        "code": 401,
        "status": "error",
        "message": "Không thể gửi mã OTP. Vui lòng thử lại",
        "detail": "Database error saving new user"
      }
    }
  })
  @ApiNotFoundResponse({
    schema: {
      example: {
        "code": 404,
        "status": "error",
        "message": "Email không tồn tại",
      }
    }
  })
  @ApiInternalServerErrorResponse({
    schema: {
      example: {
        "code": 500,
        "status": 'error',
        "message": 'Đã có lỗi hệ thống xảy ra trong quá trình đăng ký. Vui lòng thử lại sau.',
        "detail": "Đã có lỗi xảy ra"
      }
    }
  })
  sendOtp(@Body() signInReqWithOtpDto: SignInReqWithOtpDto) {
    return this.authService.sendOtp(signInReqWithOtpDto);
  }

  @ApiOperation({
    summary: "Xác thực OTP (8 số), đăng nhập",
    tags: ["Auth"]
  })
  @ApiOkResponse({
    schema: {
      example: {
        "code": 200,
        "message": "Xác thực OTP thành công",
        "status": "success",
        "data": {
          "token": "eyJhbGciOiJFUzI1NiIsImtpZCI6ImI3MDQ4MWFlLWYyZDktNGUzYy05MTIyLWM0MTc1ZmM4MWM0NyIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL290Z29ibHFnaW9kcGVybWdvbHVhLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIxMzY1OWM5MC03NGExLTRhZjItYjEyZS1mM2MyZjM3ZjA2MTIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc4NzI5NTAwLCJpYXQiOjE3Nzg2NDMxMDAsImVtYWlsIjoidGhhaW5nb2NkZzIwMDNAZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJhZ2UiOjIwLCJlbWFpbCI6InRoYWluZ29jZGcyMDAzQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmdWxsX25hbWUiOiJExrDGoW5nIFRow6FpIE5n4buNYyIsInBob25lIjoiMDk0NzkwMDQ0MiIsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwic3ViIjoiMTM2NTljOTAtNzRhMS00YWYyLWIxMmUtZjNjMmYzN2YwNjEyIn0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoib3RwIiwidGltZXN0YW1wIjoxNzc4NjQzMTAwfV0sInNlc3Npb25faWQiOiIwOGQ1OTkzZC0yNGRiLTQwMzAtYTFiZC05YWVlM2RlYWQ5NGYiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.9OV6c9AJeoGX9N3pdCRRCV2yx8lLDQ_8gbJKiNlU561Bb5vNXWtQsPlz9QkpR3ejDXuyEj7-FTJjwYcbiS55ZQ",
          "refreshToken": "p6tsulgbjy7m"
        }
      }
    }
  })
  @ApiUnauthorizedResponse({
    schema: {
      example: {
        "code": 401,
        "status": "error",
        "message": "Mã OTP không chính xác hoặc đã hết hạn",
        "detail": "Token has expired or is invalid"
      }
    }
  })

  @Post("/otp/verify")
  verifyOTP(@Body() verifyOtpReqDto: VerifyOtpReqDto) {
    return this.authService.verifyOTP(verifyOtpReqDto);
  }


  @Post("/signup")
  @ApiOperation({
    summary: "Đăng ký tài khoản",
    tags: ["Auth"]
  })
  @ApiOkResponse({
    schema: {
      example: {
        "code": 201,
        "status": "success",
        "message": "Đăng ký tài khoản thành công",
        "data": {
          "email": "triageflowopd@gmail.com",
          "id": "562662fb-447e-465c-bf9d-e21eb6303e13"
        }
      }
    }
  })
  @ApiBadRequestResponse({
    schema: {
      example: {
        "code": 400,
        "status": "error",
        "message": "Đăng ký thất bại",
        "detail": "User already registered"
      }
    }
  })
  @ApiConflictResponse({
    schema: {
      example: {
        "code": 409,
        "status": 'error',
        "message": "CMND/CCCD đã tồn tại trong hệ thống.",
      }
    }
  })
  @ApiInternalServerErrorResponse({
    schema: {
      example: {
        "code": 500,
        "status": 'error',
        "message": 'Đã có lỗi hệ thống xảy ra trong quá trình đăng ký. Vui lòng thử lại sau.',
        "detail": "Đã có lỗi xảy ra"
      }
    }
  })
  signUp(@Body() signUpReqDto: SignUpReqDto) {
    return this.authService.signUp(signUpReqDto);
  }


  @Post("/signout")
  @ApiOperation({
    summary: "Đăng xuất",
    tags: ["Auth"]
  })
  @ApiOkResponse({
    schema: {
      example: {
        "code": 200,
        "status": "success",
        "message": "Đăng xuất thành công"
      }
    }
  })
  @ApiBadRequestResponse({
    schema: {
      example: {
        "code": 400,
        "status": "error",
        "message": "Đăng xuất thất bại"
      }
    }
  })
  signOut(@Body() signOutReqDto: SignOutReqDto) {
    return this.authService.signOut(signOutReqDto);
  }



  @Post("/refresh")
  @ApiOperation({
    summary: "Làm mới token",
    tags: ["Auth"]
  })
  @ApiOkResponse({
    schema: {
      example: {
        "code": 200,
        "status": "success",
        "message": "Làm mới token thành công",
        "data": {
          "token": "eyJhbGciOiJFUzI1NiIsImtpZCI6ImI3MDQ4MWFlLWYyZDktNGUzYy05MTIyLWM0MTc1ZmM4MWM0NyIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL290Z29ibHFnaW9kcGVybWdvbHVhLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJhNjYxODQyYi1lNWMwLTQxOGQtODQwNy0zMTNmYTE1OGNhYzgiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc4NzMzODc5LCJpYXQiOjE3Nzg2NDc0NzksImVtYWlsIjoibWluaG5oaXR2MjAwOUBnbWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImFnZSI6MjAsImVtYWlsIjoibWluaG5oaXR2MjAwOUBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZnVsbF9uYW1lIjoiRMawxqFuZyBUaMOhaSBOZ-G7jWMiLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInN1YiI6ImE2NjE4NDJiLWU1YzAtNDE4ZC04NDA3LTMxM2ZhMTU4Y2FjOCJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzc4NjQ3MDAxfV0sInNlc3Npb25faWQiOiJmZTQxMzE3NC1kMjdjLTQ3NmEtYmY5Mi0yMzZkYzViMDA3YzQiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.uLf4bLAKeQDXiE7vmEZMhOfi6Ibscr2p9572TYNXSImaTClFo3pE8F1tKZXlWTLFPo0zVA5g_sJ1OcqjsT9_XQ",
          "refreshToken": "ydl2f6elan6a"
        }
      }
    }
  })
  @ApiUnauthorizedResponse({
    schema: {
      example: {
        "code": 401,
        "status": "error",
        "message": "Phiên đăng nhập đã hết hạn hoặc refresh token không hợp lệ",
        "detail": "Refresh token is not valid"
      }
    }
  })
  refreshToken(@Body() refreshTokenReqDto: RefreshTokenReqDto) {
    return this.authService.refreshToken(refreshTokenReqDto);
  }


  @Post("/forgot")
  @ApiOperation({
    summary: "Gửi otp lấy lại mật khẩu"
  })
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post("/forgot/verify")
  @ApiOperation({
    summary: "Lấy lại mật khẩu với otp"
  })
  verifyForgot(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyForgot(verifyOtpDto);
  }
}
