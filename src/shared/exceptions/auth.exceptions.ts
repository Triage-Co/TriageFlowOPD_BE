import { HttpException, HttpStatus } from '@nestjs/common';
import { RoleTypeEnum } from '@prisma/client';

export class AuthException extends HttpException {
  constructor(status: HttpStatus, message: string, detail: string) {
    super({ message, detail }, status);
  }
}

export const AuthErrors = {
  EmailExists: (email?: string) =>
    new AuthException(
      HttpStatus.CONFLICT,
      'Email đã tồn tại',
      email
        ? `Email: ${email} đã được sử dụng trong hệ thống.`
        : `Email này đã được sử dụng trong hệ thống`,
    ),
  PhoneExists: (phone?: string) =>
    new AuthException(
      HttpStatus.CONFLICT,
      'Số điện thoại đã tồn tại',
      phone
        ? `Số điện thoại: ${phone} đã được sử dụng trong hệ thống`
        : `Số điện thoại này đã được sử dụng trong hệ thống`,
    ),
  CitizenIdExists: new AuthException(
    HttpStatus.CONFLICT,
    'Lỗi trùng lặp dữ liệu',
    'CCCD/CMND này đã được sử dụng trong hệ thống.',
  ),
  UserNotFoundByEmail: (email: string) =>
    new AuthException(
      HttpStatus.NOT_FOUND,
      'Không tìm thấy người dùng',
      `Không tìm thấy người dùng với email: ${email} trong hệ thống.`,
    ),
  UserNotFoundByPhone: (phone: string) =>
    new AuthException(
      HttpStatus.NOT_FOUND,
      'Không tìm thấy người dùng',
      `Không tìm thấy người dùng với số điện thoại: ${phone} trong hệ thống.`,
    ),
  PatientNotFoundByCitizenId: (citizen_id: string) =>
    new AuthException(
      HttpStatus.NOT_FOUND,
      `Không tìm thấy Bệnh nhân với CCCD/CMND: ${citizen_id} trong hệ thống, vui lòng liên hệ lễ tân để được hỗ trợ`,
      `Không tìm thấy Bệnh nhân với CCCD/CMND: ${citizen_id} trong hệ thống.`,
    ),
  UserNotFoundById: (account_id: string) =>
    new AuthException(
      HttpStatus.NOT_FOUND,
      `Không tìm thấy người dùng với account id: ${account_id} trong hệ thống.`,
      `Không tìm thấy người dùng với account id: ${account_id} trong hệ thống`,
    ),
  EmailNotConfirmed: new AuthException(
    HttpStatus.UNAUTHORIZED,
    'Email chưa được xác thực',
    'Vui lòng xác thực email trước khi đăng nhập.',
  ),
  InvalidCredentials: new AuthException(
    HttpStatus.UNAUTHORIZED,
    'Thông tin đăng nhập không đúng',
    'Email/CCCD hoặc mật khẩu không chính xác.',
  ),
  UserBanned: new AuthException(
    HttpStatus.UNAUTHORIZED,
    'Người dùng bị cấm',
    'Tài khoản người dùng đã bị cấm',
  ),
  SendOtpFailed: (providerErrorMessage: string) =>
    new AuthException(
      HttpStatus.BAD_REQUEST,
      'Gưi OTP không thành công',
      `Gửi OTP không thành công ${providerErrorMessage}`,
    ),
  VerifyOtpFailed: (providerErrorMessage: string) =>
    new AuthException(
      HttpStatus.BAD_REQUEST,
      'Xác thực OTP không thành công',
      `Xác thực OTP không thành công ${providerErrorMessage}`,
    ),
  SendResetPasswordOtpFailed: (providerErrorMessage: string) =>
    new AuthException(
      HttpStatus.BAD_REQUEST,
      'Gửi OTP đặt lại mật khẩu không thành công',
      `Gửi OTP đặt lại mật khẩu không thành công ${providerErrorMessage}`,
    ),
  ResetPasswordFailed: (providerErrorMessage: string) =>
    new AuthException(
      HttpStatus.BAD_REQUEST,
      'Cập nhật mật khẩu mới không thành công',
      `Cập nhật mật khẩu mới không thành công ${providerErrorMessage}`,
    ),
  UpdateUserFailed: (accountId: string) =>
    new AuthException(
      HttpStatus.CONFLICT,
      'Cập nhật người dùng không thành côn',
      `cập nhật người dùng với account id: ${accountId} không thành công`,
    ),
  TokenRefreshFailed: () =>
    new AuthException(
      HttpStatus.UNAUTHORIZED,
      'Phiên đăng nhập hết hạn',
      'Phiên đăng nhập đã hết hạn hoặc refresh token không hợp lệ.',
    ),

  SignOutFailed: () =>
    new AuthException(
      HttpStatus.BAD_REQUEST,
      'Đăng xuất không thành công',
      'Đăng xuất không thành công',
    ),

  UpdateProfileFailed: (account_id: string) =>
    new AuthException(
      HttpStatus.BAD_REQUEST,
      'Cập nhật thông tin thất bại',
      `Cập nhật thông tin người dùng với id: ${account_id} không thành công`,
    ),
  UserListNotFound: () =>
    new AuthException(
      HttpStatus.NOT_FOUND,
      'Không tìm thấy dữ liệu',
      'Không tìm thấy người dùng nào trong hệ thống.',
    ),
  Unauthenticated: new AuthException(
    HttpStatus.UNAUTHORIZED,
    'Không lấy được thông tin người dùng',
    'Bạn chưa đăng nhập hoặc token không hợp lệ',
  ),
  RoleNotFound: new AuthException(
    HttpStatus.BAD_REQUEST,
    'Không lấy được vai trò người dùng',
    'Xảy ra lỗi khi lấy vai trò của người dùng',
  ),
  ForbiddenRole: (role: RoleTypeEnum[]) =>
    new AuthException(
      HttpStatus.FORBIDDEN,
      'Không đủ quyền truy cập',
      `${role ? `chỉ có ${role} mới thực hiện được hành động này` : 'Bạn không có quyền thực hiện hành động này.'}`,
    ),
  UnlockAccountFailed: (accountId: string) =>
    new AuthException(
      HttpStatus.BAD_REQUEST,
      'Mở khóa tài khoản không thành công',
      `Không thể mở khóa tài khoản với account id: ${accountId}.`,
    ),
  LockAccountFailed: (accountId: string) =>
    new AuthException(
      HttpStatus.LOCKED,
      'khóa tài khoản không thành công',
      `Không thể khóa tài khoản với account id: ${accountId}.`,
    ),
  ProviderError: (action: string, detail: string) =>
    new AuthException(HttpStatus.BAD_REQUEST, `Lỗi ${action}`, detail),
};
