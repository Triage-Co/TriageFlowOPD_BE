export const getWelcomeEmailHtml = (email: string, password?: string) => {
  return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7f6; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); overflow: hidden; }
            .header { background-color: #0056b3; color: #ffffff; padding: 24px 20px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
            .content { padding: 32px 30px; color: #333333; line-height: 1.6; }
            .content h2 { color: #1a1a1a; font-size: 22px; margin-top: 0; }
            .info-box { background-color: #f8fbff; border: 1px solid #cce5ff; border-radius: 6px; padding: 20px; margin: 24px 0; }
            .info-box p { margin: 8px 0; font-size: 15px; }
            .highlight { color: #0056b3; font-weight: bold; font-size: 16px; letter-spacing: 1px; }
            .warning { font-size: 14px; color: #d9534f; margin-top: 20px; font-weight: 500; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Triagflow OPD</h1>
            </div>
            <div class="content">
                <h2>Chào mừng bạn gia nhập hệ thống!</h2>
                <p>Xin chào,</p>
                <p>Tài khoản của bạn trên hệ thống <strong>Triagflow OPD</strong> vừa được Quản trị viên khởi tạo thành công. Dưới đây là thông tin đăng nhập của bạn:</p>
                
                <div class="info-box">
                    <p>Email: <strong>${email}</strong></p>
                    ${
                      password
                        ? `<p>Mật khẩu tạm thời: <span class="highlight">${password}</span></p>`
                        : ''
                    }
                </div>
                
                <p>Vui lòng sử dụng thông tin trên để đăng nhập vào hệ thống.</p>
                <p class="warning">Lưu ý quan trọng: Để đảm bảo an toàn bảo mật, bạn bắt buộc phải thay đổi mật khẩu ngay trong lần đăng nhập đầu tiên.</p>
            </div>
        </div>
    </body>
    </html>
  `;
};
